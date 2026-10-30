import { textContent } from "domutils";
import { parseDocument } from "htmlparser2";
import { downloadText, errorMessage, type Fetch } from "./download";
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
  const cues = parseCues(vtt);
  const paragraphs: Transcript = [];
  let paragraphCues: Cue[] = [];
  let words = 0;
  for (const [i, cue] of cues.entries()) {
    paragraphCues.push(cue);
    words += cue.text.split(" ").length;
    const next = cues[i + 1];
    const pause =
      next !== undefined && next.startSeconds - cue.endSeconds >= PAUSE_SECONDS;
    const last = next === undefined;
    if (
      last ||
      words >= MAX_WORDS ||
      (words >= MIN_WORDS && (endsSentence(cue.text) || pause))
    ) {
      const [first = cue] = paragraphCues;
      paragraphs.push({
        startSeconds: first.startSeconds,
        text: paragraphCues.map(({ text }) => text).join(" "),
      });
      paragraphCues = [];
      words = 0;
    }
  }
  return paragraphs;
}

// A period after an initial ("George W.") or a title ("St. Francis") ends no
// sentence, though one after "I" ("so did I.") does.
const ABBREVIATION = /(?:^|\s)(?:[A-HJ-Z]|Dr|Mr|Mrs|Ms|St|Jr|Sr|vs)\.$/;

function endsSentence(text: string): boolean {
  return /[.!?]["'”’)]*$/.test(text) && !ABBREVIATION.test(text);
}

// A cue's timing line: "[hh:]mm:ss.ttt --> [hh:]mm:ss.ttt" and any settings.
const TIMESTAMP = String.raw`(?:\d+:)?\d{2}:\d{2}\.\d{3}`;
const TIMING = new RegExp(`^(${TIMESTAMP})[ \\t]+-->[ \\t]+(${TIMESTAMP})`);

// The cue blocks of a WebVTT file, in order. Notes, styles, regions and the
// header have no timing line and are skipped.
function parseCues(vtt: string): Cue[] {
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
  fetch: Fetch;
  // Where the build log notes an Episode left without its Transcript.
  warn: (message: string) => void;
};

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
    return parseTranscript(await downloadText("Transcript", url, io.fetch));
  } catch (error: unknown) {
    io.warn(
      `Episode "${episode.title}" left without its Transcript: ${errorMessage(error)}`
    );
    return null;
  }
}
