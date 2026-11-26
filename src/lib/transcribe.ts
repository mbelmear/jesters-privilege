// The Transcribe workflow (ADR 0003): Spreaker makes no Transcripts, so each
// Episode the feed links none for is transcribed once, in its first week
// (NEW_FOR_DAYS) unless the run was started by hand (#240), with Whisper on
// GitHub's runners, and saved as `<episode-guid>.vtt` on the `transcripts`
// branch, which builds read. An Episode with a saved Transcript is never
// transcribed again, so a hand fix to its file sticks.
// Run by scripts/transcribe.ts in .github/workflows/transcribe.yml.
import { errorMessage } from "./download";
import type { Episode } from "./feed";
import { parseTranscript, transcriptFileName } from "./transcript";

export type TranscribableEpisode = Pick<
  Episode,
  "guid" | "title" | "publishedAt" | "audioUrl" | "transcriptUrl"
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

// How long an Episode counts as new (#240). The show releases about every
// other week. Deploy starts a run once it deploys a new Episode (ADR 0004),
// and a week of Transcribe's own schedule, even at the twice a day GitHub has
// run it, is ample to retry a failure.
export const NEW_FOR_DAYS = 7;
const NEW_FOR_MS = NEW_FOR_DAYS * 24 * 60 * 60 * 1000;

export type TranscribePlan<E> = { transcribe: E[]; refused: E[] };

// When the run started, and whether it was started by hand (Run workflow),
// which lifts the first-week limit. The plan step and the Transcribe step each
// read the clock, so an Episode at the limit could be planned and then refused
// minutes later; that run goes red naming it, and Run workflow transcribes it.
export type TranscribeRun = { now: Date; anyAge: boolean };

// Which Episodes a run transcribes. A scheduled run takes only new ones: an
// older Episode needing a Transcript means the branch lost a file or was read
// wrong, so it's refused rather than sent to Whisper. A run started by hand
// (`anyAge`) takes any Episode, to make a missing Transcript on purpose.
export async function planTranscripts<E extends TranscribableEpisode>(
  episodes: readonly E[],
  io: Pick<TranscribeIO, "isSaved">,
  { now, anyAge }: TranscribeRun
): Promise<TranscribePlan<E>> {
  const needed = await needingTranscripts(episodes, io);
  const isNew = (e: E) => now.getTime() - e.publishedAt.getTime() <= NEW_FOR_MS;
  return {
    transcribe: needed.filter((e) => anyAge || isNew(e)),
    refused: needed.filter((e) => !anyAge && !isNew(e)),
  };
}

// An ::error:: line for each Episode the plan refused.
export function refusalErrors(
  refused: readonly TranscribableEpisode[]
): string[] {
  return refused.map(
    ({ title, guid }) =>
      `::error::"${title}" (${guid}) is older than ${NEW_FOR_DAYS} days and has no Transcript saved. Only a run started from Run workflow on Transcribe transcribes an Episode that old; press it to transcribe this one on purpose.`
  );
}

// What the workflow's plan step logs, sets as `needed`, and exits with. With
// nothing new to transcribe the run ends at the plan, so the plan names and
// fails on what it refused, before Whisper is built; otherwise the Transcribe
// step does, after saving the new ones (runTranscribe).
export function planStep(plan: TranscribePlan<TranscribableEpisode>): {
  needed: boolean;
  lines: string[];
  exitCode: number;
} {
  if (plan.transcribe.length > 0) {
    return {
      needed: true,
      lines: plan.transcribe.map(
        ({ title }) => `::notice::"${title}" needs a Transcript`
      ),
      exitCode: 0,
    };
  }
  return {
    needed: false,
    lines: refusalErrors(plan.refused),
    exitCode: plan.refused.length > 0 ? 1 : 0,
  };
}

// Transcribes and saves each Episode the plan picks (planTranscripts), one at
// a time, and returns the exit code. An Episode the plan refused is named and
// fails the run (1). A failure leaves that Episode without one and goes on to
// the next; the run then fails (1), so the failure email names it and the
// next run tries that Episode again.
export async function runTranscribe(
  episodes: readonly TranscribableEpisode[],
  io: TranscribeIO,
  run: TranscribeRun
): Promise<number> {
  const { transcribe, refused } = await planTranscripts(episodes, io, run);
  for (const line of refusalErrors(refused)) io.log(line);
  if (transcribe.length === 0 && refused.length === 0) {
    io.log("::notice::Every Episode has a Transcript");
    return 0;
  }
  let failed = refused.length > 0;
  for (const episode of transcribe) {
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
