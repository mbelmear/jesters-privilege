import { textContent } from "domutils";
import { parseDocument } from "htmlparser2";
import { downloadText, errorMessage, type Fetch } from "./download";
import type { Episode } from "./feed";

// An Episode's Transcript as readers see it: paragraphs, each with the time
// its first words are spoken, so a timestamp can seek the player.
export type TranscriptParagraph = { startSeconds: number; text: string };
export type Transcript = TranscriptParagraph[];

type Cue = { startSeconds: number; endSeconds: number; text: string };

// Which paragraph is being spoken `position` seconds in: the last one to have
// started. Before the first paragraph's words begin, it's the first.
export function currentParagraph(
  transcript: Transcript,
  position: number
): number {
  const next = transcript.findIndex(
    (paragraph) => paragraph.startSeconds > position
  );
  if (next === -1) return transcript.length - 1;
  return Math.max(next - 1, 0);
}

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
  // Downloads the Transcript the feed links to.
  fetch: Fetch;
  // The site's own Transcript, saved under this file name on the
  // `transcripts` branch (ADR 0003), or null when none is saved. Throws
  // when the branch can't be read.
  saved: (fileName: string) => Promise<string | null>;
  // Where the build log notes an Episode left without its Transcript.
  warn: (message: string) => void;
};

// The file the site's own Transcript of an Episode is saved as on the
// `transcripts` branch: its feed GUID, encoded so that any GUID (Spreaker's
// are URLs) makes one file name, and a hand fix finds the file by it.
export function transcriptFileName(guid: string): string {
  return `${encodeURIComponent(guid)}.vtt`;
}

// An Episode's Transcript as WebVTT that reads, or null when it has none.
// The host's Transcript is used when the feed links one; otherwise the site's
// own (docs/spec.md, Transcripts). A Transcript that is missing, unreachable
// or unreadable leaves the Episode without one rather than failing the
// build, since the Episode is worth publishing without it; the build log
// names the Episode and why.
export async function loadTranscriptText(
  episode: Pick<Episode, "guid" | "title" | "transcriptUrl">,
  io: TranscriptIO
): Promise<string | null> {
  const url = episode.transcriptUrl;
  const fileName = transcriptFileName(episode.guid);
  try {
    const text = url
      ? await downloadText("Transcript", url, io.fetch)
      : await io.saved(fileName);
    if (text === null) {
      io.warn(
        `Episode "${episode.title}" has no Transcript yet: the feed links none, and the transcripts branch has no ${fileName}`
      );
      return null;
    }
    parseTranscript(text);
    return text;
  } catch (error: unknown) {
    io.warn(
      `Episode "${episode.title}" left without its Transcript: ${errorMessage(error)}`
    );
    return null;
  }
}

// Each Episode's Transcript as WebVTT, by feed GUID; an Episode with none is
// left out.
export type TranscriptTexts = ReadonlyMap<string, string>;

export async function loadTranscriptTexts(
  episodes: readonly Pick<Episode, "guid" | "title" | "transcriptUrl">[],
  io: TranscriptIO
): Promise<TranscriptTexts> {
  const texts = await Promise.all(
    episodes.map(
      async (episode) =>
        [episode.guid, await loadTranscriptText(episode, io)] as const
    )
  );
  return new Map(
    texts.flatMap(([guid, text]) => (text === null ? [] : [[guid, text]]))
  );
}

// Transcripts as JSON, so a build from the live feed reads them once, before
// Next's workers render the pages and the build manifest, and every one of
// them reads the same answer (scripts/transcripts.ts).
export function serializeTranscriptTexts(texts: TranscriptTexts): {
  [guid: string]: string;
} {
  return Object.fromEntries(texts);
}

export function parseTranscriptTexts(value: unknown): TranscriptTexts {
  const shape = "Transcripts snapshot must map Episode GUIDs to WebVTT text";
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(shape);
  }
  const entries: [string, unknown][] = Object.entries(value);
  return new Map(
    entries.map(([guid, text]) => {
      if (typeof text !== "string") throw new Error(shape);
      return [guid, text];
    })
  );
}
