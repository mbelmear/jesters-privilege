// The Transcribe workflow's step (#121, ADR 0003): transcribes each Episode
// with neither a Transcript the feed links nor one saved on the `transcripts`
// branch, and published in the last 7 days unless TRANSCRIBE_ANY_AGE=true
// (#240), with whisper.cpp, into that branch's checkout. The workflow commits
// and pushes what it writes. The logic is src/lib/transcribe.ts; this wires in
// the feed, the files, and Whisper.
//
// Usage (run by .github/workflows/transcribe.yml, with FEED=live):
//   npm run transcribe -- --plan   sets the step output `needed` to true or
//                                  false, so the workflow sets Whisper up
//                                  only when there's work, and fails
//                                  naming any older Episode it refused
//   npm run transcribe             transcribes; needs WHISPER_CLI and
//                                  WHISPER_MODEL, and ffmpeg on the PATH
// TRANSCRIPTS_DIR is the branch's checkout.
import { execFile } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { getEpisodes } from "@/content/feed";
import { jesters } from "@/content/jesters";
import {
  planTranscripts,
  refusals,
  runTranscribe,
  transcriptionPrompt,
  type TranscribableEpisode,
} from "@/lib/transcribe";

// Names Whisper would otherwise misspell (docs/spec.md, Transcripts).
const HARD_NAMES = ["Stańczyk", "Triboulet", "Redeemer", "Bozeman"];

const run = promisify(execFile);

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} isn't set`);
  return value;
}

const dir = env("TRANSCRIPTS_DIR");
const isSaved = async (fileName: string) => existsSync(join(dir, fileName));

function setOutput(name: string, value: string) {
  const line = `${name}=${value}\n`;
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) appendFileSync(outputFile, line);
  else process.stdout.write(line);
}

// Downloads the Episode's audio, converts it to the 16 kHz mono WAV that
// whisper.cpp reads, and transcribes it to WebVTT.
async function whisper(episode: TranscribableEpisode): Promise<string> {
  const work = await mkdtemp(join(tmpdir(), "transcribe-"));
  try {
    const response = await fetch(episode.audioUrl, {
      signal: AbortSignal.timeout(10 * 60_000),
    });
    if (!response.ok) {
      throw new Error(
        `Audio ${episode.audioUrl} answered ${response.status} ${response.statusText}`
      );
    }
    const audio = join(work, "audio");
    await writeFile(audio, Buffer.from(await response.arrayBuffer()));
    const wav = join(work, "audio.wav");
    await run("ffmpeg", [
      "-loglevel",
      "error",
      "-i",
      audio,
      "-ar",
      "16000",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      wav,
    ]);
    const out = join(work, "transcript");
    const prompt = transcriptionPrompt(
      jesters.map(({ name }) => name.split(" ")[0] ?? name),
      HARD_NAMES
    );
    const started = Date.now();
    await run(
      env("WHISPER_CLI"),
      [
        "-m",
        env("WHISPER_MODEL"),
        "-f",
        wav,
        "-l",
        "en",
        "-t",
        String(availableParallelism()),
        "--prompt",
        prompt,
        "-ovtt",
        "-of",
        out,
        "-np",
      ],
      { maxBuffer: 64 * 1024 * 1024 }
    );
    console.log(
      `Transcribed "${episode.title}" in ${Math.round((Date.now() - started) / 1000)}s`
    );
    return await readFile(`${out}.vtt`, "utf8");
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

// A run the workflow says was started by hand transcribes Episodes of any age
// (#240); every other run only new ones.
const options = {
  now: new Date(),
  anyAge: process.env.TRANSCRIBE_ANY_AGE === "true",
};

async function main(): Promise<number> {
  const episodes = await getEpisodes();
  if (process.argv.includes("--plan")) {
    const { transcribe, refused } = await planTranscripts(
      episodes,
      { isSaved },
      options
    );
    for (const { title } of transcribe) {
      console.log(`::notice::"${title}" needs a Transcript`);
    }
    setOutput("needed", String(transcribe.length > 0));
    // With nothing new to transcribe, the run ends here, so the plan names
    // and fails on what it refused; otherwise the Transcribe step does.
    if (transcribe.length > 0) return 0;
    for (const line of refusals(refused)) console.log(line);
    return refused.length > 0 ? 1 : 0;
  }
  return runTranscribe(
    episodes,
    {
      isSaved,
      transcribe: whisper,
      save: (fileName, text) => writeFile(join(dir, fileName), text),
      log: (line) => console.log(line),
    },
    options
  );
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  }
);
