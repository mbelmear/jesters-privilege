import {
  loadTranscript,
  parseTranscript,
  type TranscriptIO,
} from "./transcript";

// Builds WebVTT shaped like Spreaker's: numbered cues, hh:mm:ss.mmm timings,
// and a voice span naming the speaker.
type Cue = { start: string; end: string; text: string; speaker?: number };

function vtt(cues: Cue[]): string {
  const blocks = cues.map(
    ({ start, end, text, speaker = 1 }, i) =>
      `${i + 1}\n${start} --> ${end}\n<v Speaker ${speaker}>${text}`
  );
  return ["WEBVTT", ...blocks].join("\n\n") + "\n";
}

// A run of `count` words, ending as given, for cues of a known length.
function words(count: number, ending = ""): string {
  return (
    Array.from({ length: count }, (_, i) => `word${i + 1}`).join(" ") + ending
  );
}

// Times on the 00:00:ss.mmm clock, from seconds.
function at(seconds: number): string {
  const whole = Math.floor(seconds);
  const millis = Math.round((seconds - whole) * 1000);
  return `00:${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

// Back-to-back cues of the given texts, each three seconds long.
function backToBack(texts: string[]): Cue[] {
  return texts.map((text, i) => ({
    start: at(i * 3),
    end: at(i * 3 + 3),
    text,
  }));
}

describe("parseTranscript", () => {
  it("shows the words without markup or character references", () => {
    expect(
      parseTranscript(
        vtt([
          {
            start: at(0),
            end: at(3),
            text: "Q&amp;A: <i>is</i> 1 &lt; 2?&nbsp;Fish <00:00:02.000><c.loud>&amp;</c> chips &gt; all.",
          },
        ])
      )
    ).toEqual([
      { startSeconds: 0, text: "Q&A: is 1 < 2? Fish & chips > all." },
    ]);
  });

  it("reads Windows line endings, a byte order mark, notes, cue settings, and short timings", () => {
    const text = [
      "\uFEFFWEBVTT - Jester's Privilege",
      "",
      "NOTE Draft stand-in --> not a cue",
      "",
      "01:05.250 --> 01:07.000 align:start line:90%",
      "First line",
      "second line.",
      "",
    ].join("\r\n");
    expect(parseTranscript(text)).toEqual([
      { startSeconds: 65.25, text: "First line second line." },
    ]);
  });

  it("joins cues that split a sentence into one paragraph", () => {
    expect(
      parseTranscript(
        vtt(
          backToBack([
            "So the question this week",
            "is whether humor is a virtue.",
          ])
        )
      )
    ).toEqual([
      {
        startSeconds: 0,
        text: "So the question this week is whether humor is a virtue.",
      },
    ]);
  });

  it("starts a new paragraph after a sentence ends, once the paragraph is long enough", () => {
    const paragraphs = parseTranscript(
      vtt(backToBack([words(20), words(20, "."), words(10)]))
    );
    expect(paragraphs.map((p) => p.startSeconds)).toEqual([0, 6]);
  });

  it("starts a new paragraph after a pause, once the paragraph is long enough", () => {
    const paragraphs = parseTranscript(
      vtt([
        { start: at(0), end: at(10), text: words(40) },
        { start: at(11), end: at(14), text: words(10) },
      ])
    );
    expect(paragraphs.map((p) => p.startSeconds)).toEqual([0, 11]);
  });

  it("runs on through the short gaps between words", () => {
    const paragraphs = parseTranscript(
      vtt([
        { start: at(0), end: at(10), text: words(40) },
        { start: at(10.4), end: at(14), text: words(10) },
      ])
    );
    expect(paragraphs.map((p) => p.startSeconds)).toEqual([0]);
  });

  it("breaks a long unpunctuated stretch at a cue boundary", () => {
    const paragraphs = parseTranscript(
      vtt(backToBack(Array.from({ length: 30 }, () => words(10))))
    );
    expect(paragraphs.map((p) => p.startSeconds)).toEqual([0, 36, 72]);
  });

  it.each(["George W.", "St.", "Dr.", "Mr.", "Mrs."])(
    "doesn't take the abbreviation %s for a sentence end",
    (abbreviation) => {
      const paragraphs = parseTranscript(
        vtt(
          backToBack([
            words(40, ` ${abbreviation}`),
            "Francis was a holy fool.",
          ])
        )
      );
      expect(paragraphs.map((p) => p.startSeconds)).toEqual([0]);
    }
  );

  it('takes "I." at the end of a cue for a sentence end', () => {
    const paragraphs = parseTranscript(
      vtt(backToBack([words(40, " and so did I."), "Francis was a holy fool."]))
    );
    expect(paragraphs.map((p) => p.startSeconds)).toEqual([0, 3]);
  });

  it("rejects a file that isn't WebVTT", () => {
    expect(() =>
      parseTranscript('<?xml version="1.0"?><Error>AccessDenied</Error>')
    ).toThrow("Transcript isn't WebVTT: it doesn't start with WEBVTT");
  });

  it("rejects a Transcript with no words in it", () => {
    expect(() =>
      parseTranscript(vtt([{ start: at(0), end: at(3), text: " " }]))
    ).toThrow("Transcript has no cues with words in them");
  });

  it("keeps a short sentence with what follows", () => {
    const paragraphs = parseTranscript(
      vtt(backToBack(["Amen.", words(20), words(10, ".")]))
    );
    expect(paragraphs.map((p) => p.startSeconds)).toEqual([0]);
  });

  it("turns a cue into a paragraph that starts at the cue's time", () => {
    expect(
      parseTranscript(
        vtt([
          {
            start: "00:01:02.500",
            end: "00:01:05.000",
            text: "Welcome to Jester's Privilege.",
          },
        ])
      )
    ).toEqual([{ startSeconds: 62.5, text: "Welcome to Jester's Privilege." }]);
  });
});

describe("loadTranscript", () => {
  const url = "https://transcription.spreaker.com/starship/abc/abc.vtt";
  const episode = { title: "Celebrity Pastors", transcriptUrl: url };
  const transcript = vtt([{ start: at(0), end: at(3), text: "Welcome." }]);

  function io(fetch: TranscriptIO["fetch"]) {
    const warnings: string[] = [];
    return { warnings, io: { fetch, warn: (m: string) => warnings.push(m) } };
  }

  function response(status: number, statusText: string, body = "") {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText,
      text: () => Promise.resolve(body),
    });
  }

  it("downloads and reads an Episode's Transcript", async () => {
    const { io: fake, warnings } = io((u) =>
      response(200, "OK", u === url ? transcript : "")
    );
    expect(await loadTranscript(episode, fake)).toEqual([
      { startSeconds: 0, text: "Welcome." },
    ]);
    expect(warnings).toEqual([]);
  });

  it("leaves an Episode with no Transcript link without one, quietly", async () => {
    const { io: fake, warnings } = io(() =>
      Promise.reject(new Error("fetch not expected"))
    );
    expect(
      await loadTranscript({ ...episode, transcriptUrl: null }, fake)
    ).toBeNull();
    expect(warnings).toEqual([]);
  });

  it("leaves the Episode without one when the Transcript is missing", async () => {
    const { io: fake, warnings } = io(() => response(403, "Forbidden"));
    expect(await loadTranscript(episode, fake)).toBeNull();
    expect(warnings).toEqual([
      `Episode "Celebrity Pastors" left without its Transcript: Transcript ${url} answered 403 Forbidden`,
    ]);
  });

  it("leaves the Episode without one when the Transcript can't be reached", async () => {
    const { io: fake, warnings } = io(() =>
      Promise.reject(
        new DOMException("The operation timed out.", "TimeoutError")
      )
    );
    expect(await loadTranscript(episode, fake)).toBeNull();
    expect(warnings).toEqual([
      `Episode "Celebrity Pastors" left without its Transcript: Transcript ${url} couldn't be reached: The operation timed out.`,
    ]);
  });

  it("leaves the Episode without one when the Transcript can't be read", async () => {
    const { io: fake, warnings } = io(() =>
      response(200, "OK", "<html></html>")
    );
    expect(await loadTranscript(episode, fake)).toBeNull();
    expect(warnings).toEqual([
      `Episode "Celebrity Pastors" left without its Transcript: Transcript isn't WebVTT: it doesn't start with WEBVTT`,
    ]);
  });
});
