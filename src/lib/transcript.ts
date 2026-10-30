import { textContent } from "domutils";
import { parseDocument } from "htmlparser2";
import type { Episode } from "./feed";

// An Episode's Transcript as readers see it: paragraphs, each with the time
// its first words are spoken, so a timestamp can seek the player.
export type TranscriptParagraph = { startSeconds: number; text: string };
export type Transcript = TranscriptParagraph[];

type Cue = { startSeconds: number; endSeconds: number; text: string };

// A paragraph ends at the first sentence end or pause after this many words,
// so a one-line exchange ("Amen.") stays with what follows.
const MIN_WORDS = 40;
// Machine Transcripts often run on without punctuation, so a paragraph ends
// at the cue that takes it to this length, sentence end or not.
const MAX_WORDS = 120;
// Silence between cues long enough to read as a pause. Speech in Spreaker's
// Transcripts leaves well under half a second between cues.
const PAUSE_SECONDS = 1;

// WebVTT text in, readable paragraphs out. Throws, naming the problem, when
// the text isn't WebVTT or holds no words.
export function parseTranscript(vtt: string): Transcript {
  const all = cues(vtt);
  const paragraphs: Transcript = [];
  let current: Cue[] = [];
  let words = 0;
  for (const [i, cue] of all.entries()) {
    current.push(cue);
    words += cue.text.split(" ").length;
    const next = all[i + 1];
    const pause =
      next !== undefined && next.startSeconds - cue.endSeconds >= PAUSE_SECONDS;
    const last = next === undefined;
    if (
      last ||
      words >= MAX_WORDS ||
      (words >= MIN_WORDS && (endsSentence(cue.text) || pause))
    ) {
      const [first = cue] = current;
      paragraphs.push({
        startSeconds: first.startSeconds,
        text: current.map(({ text }) => text).join(" "),
      });
      current = [];
      words = 0;
    }
  }
  return paragraphs;
}

// A period after an initial ("George W.") or a title ("St. Francis") ends no
// sentence.
const ABBREVIATION = /(?:^|\s)(?:[A-Z]|Dr|Mr|Mrs|Ms|St|Jr|Sr|vs)\.$/;

function endsSentence(text: string): boolean {
  return /[.!?]["'”’)]*$/.test(text) && !ABBREVIATION.test(text);
}

// A cue's timing line: "[hh:]mm:ss.ttt --> [hh:]mm:ss.ttt" and any settings.
const TIMESTAMP = String.raw`(?:\d+:)?\d{2}:\d{2}\.\d{3}`;
const TIMING = new RegExp(`^(${TIMESTAMP})[ \\t]+-->[ \\t]+(${TIMESTAMP})`);

// The cue blocks of a WebVTT file, in order. Notes, styles, regions and the
// header have no timing line and are skipped.
function cues(vtt: string): Cue[] {
  const text = vtt.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (!/^WEBVTT(?:[ \t\n]|$)/.test(text)) {
    throw new Error("Transcript isn't WebVTT: it doesn't start with WEBVTT");
  }
  const found = text
    .split(/\n{2,}/)
    .flatMap((block) => {
      const lines = block.split("\n");
      const timing = lines.findIndex((line) => TIMING.test(line));
      const [, start, end] = TIMING.exec(lines[timing] ?? "") ?? [];
      if (/^NOTE\b/.test(block) || !start || !end) return [];
      return [
        {
          startSeconds: seconds(start),
          endSeconds: seconds(end),
          text: cueText(lines.slice(timing + 1).join("\n")),
        },
      ];
    })
    .filter((cue) => cue.text);
  if (found.length === 0) {
    throw new Error("Transcript has no cues with words in them");
  }
  return found;
}

// Cue text is markup: voice and class spans, inline timestamps, and character
// references. Readers get the words alone.
function cueText(markup: string): string {
  const withoutTimestamps = markup.replace(
    new RegExp(`<${TIMESTAMP}>`, "g"),
    ""
  );
  return textContent(parseDocument(withoutTimestamps))
    .replace(/\s+/g, " ")
    .trim();
}

function seconds(timestamp: string): number {
  return timestamp
    .split(":")
    .reduce((total, part) => total * 60 + Number(part), 0);
}

export type TranscriptIO = {
  fetch: (url: string) => Promise<TranscriptResponse>;
  // Where the build log notes an Episode left without its Transcript.
  warn: (message: string) => void;
};

type TranscriptResponse = Pick<
  Response,
  "ok" | "status" | "statusText" | "text"
>;

// An Episode's Transcript, or null when it has none. A Transcript that is
// missing, unreachable or unreadable leaves the Episode without one rather
// than failing the build, since the Episode is worth publishing without it.
export async function loadTranscript(
  episode: Pick<Episode, "title" | "transcriptUrl">,
  io: TranscriptIO
): Promise<Transcript | null> {
  const url = episode.transcriptUrl;
  if (!url) return null;
  try {
    return parseTranscript(await download(url, io));
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    io.warn(`Transcript of "${episode.title}" skipped: ${reason}`);
    return null;
  }
}

async function download(url: string, io: TranscriptIO): Promise<string> {
  let response: TranscriptResponse;
  try {
    response = await io.fetch(url);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${url} couldn't be reached: ${reason}`);
  }
  if (!response.ok) {
    throw new Error(
      `${url} answered ${response.status} ${response.statusText}`
    );
  }
  return response.text();
}
