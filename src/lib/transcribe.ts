// The Transcribe workflow (ADR 0003): Spreaker makes no Transcripts, so each
// Episode the feed links none for is transcribed once, with Whisper on
// GitHub's runners, and saved as `<episode-guid>.vtt` on the `transcripts`
// branch, which builds read. An Episode with a saved Transcript is never
// transcribed again, so a hand fix to its file sticks.
// Run by scripts/transcribe.ts in .github/workflows/transcribe.yml.
import { errorMessage } from "./download";
import type { Episode } from "./feed";
import { parseTranscript, transcriptFileName } from "./transcript";

export type TranscribableEpisode = Pick<
  Episode,
  "guid" | "title" | "audioUrl" | "transcriptUrl"
>;

export type TranscribeIO = {
  // Whether the transcripts branch holds this file.
  isSaved: (fileName: string) => Promise<boolean>;
  // The Episode's audio as WebVTT. Whisper in the workflow; a fake in tests.
  transcribe: (episode: TranscribableEpisode) => Promise<string>;
  // Writes the file to the transcripts branch's checkout.
  save: (fileName: string, text: string) => Promise<void>;
  // Workflow-command log lines (::notice::, ::error::).
  log: (line: string) => void;
};

// The Episodes with neither a Transcript the feed links nor a saved one, in
// the feed's order (newest first).
export async function needingTranscripts<E extends TranscribableEpisode>(
  episodes: readonly E[],
  io: Pick<TranscribeIO, "isSaved">
): Promise<E[]> {
  const saved = await Promise.all(
    episodes.map((e) => io.isSaved(transcriptFileName(e.guid)))
  );
  return episodes.filter((e, i) => e.transcriptUrl === null && !saved[i]);
}

// Transcribes and saves each Episode that needs a Transcript, one at a time,
// and returns the exit code. A failure leaves that Episode without one and
// goes on to the next; the run then fails (1), so the failure email names it
// and the next run tries that Episode again.
export async function runTranscribe(
  episodes: readonly TranscribableEpisode[],
  io: TranscribeIO
): Promise<number> {
  const needed = await needingTranscripts(episodes, io);
  if (needed.length === 0) {
    io.log("::notice::Every Episode has a Transcript");
    return 0;
  }
  let failed = false;
  for (const episode of needed) {
    const fileName = transcriptFileName(episode.guid);
    try {
      const text = await io.transcribe(episode);
      parseTranscript(text);
      await io.save(fileName, text);
      io.log(
        `::notice::Saved the Transcript of "${episode.title}" as ${fileName}`
      );
    } catch (error: unknown) {
      failed = true;
      io.log(
        `::error::"${episode.title}" is left without a Transcript: ${errorMessage(error)}`
      );
    }
  }
  return failed ? 1 : 0;
}

// Whisper's initial prompt: text it takes as already said, so it spells the
// names in it as written.
export function transcriptionPrompt(
  jesters: readonly string[],
  hardNames: readonly string[]
): string {
  const names =
    jesters.length > 1
      ? `${jesters.slice(0, -1).join(", ")}, and ${jesters.at(-1)}`
      : jesters.join("");
  return `Jester's Privilege, with ${names}. ${hardNames.join(", ")}.`;
}
