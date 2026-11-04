import {
  currentParagraph,
  loadTranscriptText,
  loadTranscriptTexts,
  parseTranscriptTexts,
  serializeTranscriptTexts,
  parseTranscript,
  transcriptFileName,
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

describe("loadTranscriptText", () => {
  const url = "https://transcription.spreaker.com/starship/abc/abc.vtt";
  const guid = "https://api.spreaker.com/episode/76161078";
  const episode = { guid, title: "Celebrity Pastors", transcriptUrl: url };
  const unlinked = { ...episode, transcriptUrl: null };
  const transcript = vtt([{ start: at(0), end: at(3), text: "Welcome." }]);
  const savedTranscript = vtt([
    { start: at(0), end: at(3), text: "Welcome, says Whisper." },
  ]);

  // The host serves what `fetch` answers; the transcripts branch holds
  // `saved`, by file name.
  function io(
    fetch: TranscriptIO["fetch"],
    saved: Record<string, string> = {}
  ) {
    const warnings: string[] = [];
    const io: TranscriptIO = {
      fetch,
      saved: async (fileName) => saved[fileName] ?? null,
      warn: (m: string) => warnings.push(m),
    };
    return { warnings, io };
  }

  const noFetch = () => Promise.reject(new Error("fetch not expected"));

  function response(status: number, statusText: string, body = "") {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText,
      text: () => Promise.resolve(body),
    });
  }

  it("downloads the Transcript the feed links", async () => {
    const { io: fake, warnings } = io((u) =>
      response(200, "OK", u === url ? transcript : "")
    );
    expect(await loadTranscriptText(episode, fake)).toBe(transcript);
    expect(warnings).toEqual([]);
  });

  it("reads the site's own Transcript when the feed links none", async () => {
    const { io: fake, warnings } = io(noFetch, {
      "https%3A%2F%2Fapi.spreaker.com%2Fepisode%2F76161078.vtt":
        savedTranscript,
    });
    expect(await loadTranscriptText(unlinked, fake)).toBe(savedTranscript);
    expect(warnings).toEqual([]);
  });

  it("prefers the Transcript the feed links to the site's own", async () => {
    const { io: fake } = io(
      (u) => response(200, "OK", u === url ? transcript : ""),
      {
        [transcriptFileName(guid)]: savedTranscript,
      }
    );
    expect(await loadTranscriptText(episode, fake)).toBe(transcript);
  });

  it("says so when an Episode has no Transcript yet", async () => {
    const { io: fake, warnings } = io(noFetch);
    expect(await loadTranscriptText(unlinked, fake)).toBeNull();
    expect(warnings).toEqual([
      `Episode "Celebrity Pastors" has no Transcript yet: the feed links none, and the transcripts branch has no ${transcriptFileName(guid)}`,
    ]);
  });

  it("leaves the Episode without one when its saved Transcript can't be had", async () => {
    const { io: fake, warnings } = io(noFetch);
    fake.saved = () =>
      Promise.reject(new Error("Saved Transcript x answered 500 Server Error"));
    expect(await loadTranscriptText(unlinked, fake)).toBeNull();
    expect(warnings).toEqual([
      `Episode "Celebrity Pastors" left without its Transcript: Saved Transcript x answered 500 Server Error`,
    ]);
  });

  it("leaves the Episode without one when its saved Transcript can't be read", async () => {
    const { io: fake, warnings } = io(noFetch, {
      [transcriptFileName(guid)]: "",
    });
    expect(await loadTranscriptText(unlinked, fake)).toBeNull();
    expect(warnings).toEqual([
      `Episode "Celebrity Pastors" left without its Transcript: Transcript isn't WebVTT: it doesn't start with WEBVTT`,
    ]);
  });

  it("leaves the Episode without one when the Transcript is missing", async () => {
    const { io: fake, warnings } = io(() => response(403, "Forbidden"));
    expect(await loadTranscriptText(episode, fake)).toBeNull();
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
    expect(await loadTranscriptText(episode, fake)).toBeNull();
    expect(warnings).toEqual([
      `Episode "Celebrity Pastors" left without its Transcript: Transcript ${url} couldn't be reached: The operation timed out.`,
    ]);
  });

  it("leaves the Episode without one when the Transcript can't be read", async () => {
    const { io: fake, warnings } = io(() =>
      response(200, "OK", "<html></html>")
    );
    expect(await loadTranscriptText(episode, fake)).toBeNull();
    expect(warnings).toEqual([
      `Episode "Celebrity Pastors" left without its Transcript: Transcript isn't WebVTT: it doesn't start with WEBVTT`,
    ]);
  });
});

describe("loadTranscriptTexts", () => {
  const savedTranscript = vtt([{ start: at(0), end: at(3), text: "Hello." }]);
  const episodes = [
    { guid: "ep-2", title: "Mockery", transcriptUrl: null },
    { guid: "ep-1", title: "Celebrity Pastors", transcriptUrl: null },
  ];

  it("holds each Episode's Transcript by GUID, leaving out those with none", async () => {
    const warnings: string[] = [];
    const texts = await loadTranscriptTexts(episodes, {
      fetch: () => Promise.reject(new Error("fetch not expected")),
      saved: async (fileName) =>
        fileName === "ep-1.vtt" ? savedTranscript : null,
      warn: (m) => warnings.push(m),
    });
    expect([...texts]).toEqual([["ep-1", savedTranscript]]);
    expect(warnings).toHaveLength(1);
  });
});

describe("parseTranscriptTexts", () => {
  it("reads back what serializing wrote", () => {
    const texts = new Map([["ep-1", "WEBVTT\n"]]);
    expect(
      parseTranscriptTexts(
        JSON.parse(JSON.stringify(serializeTranscriptTexts(texts)))
      )
    ).toEqual(texts);
  });

  it.each([
    ["not an object", "WEBVTT"],
    ["a list", ["WEBVTT"]],
    ["a Transcript that isn't text", { "ep-1": 3 }],
  ])("refuses a snapshot that is %s", (_, value) => {
    expect(() => parseTranscriptTexts(value)).toThrow(
      "Transcripts snapshot must map Episode GUIDs to WebVTT text"
    );
  });
});

describe("transcriptFileName", () => {
  it("names the file after the Episode's GUID, whatever characters it holds", () => {
    expect(
      transcriptFileName("https://api.spreaker.com/episode/76161078")
    ).toBe("https%3A%2F%2Fapi.spreaker.com%2Fepisode%2F76161078.vtt");
    expect(transcriptFileName("6a1f0c4e-0001")).toBe("6a1f0c4e-0001.vtt");
  });
});

describe("currentParagraph", () => {
  const transcript = [
    { startSeconds: 2.5, text: "Welcome to Jester's Privilege." },
    { startSeconds: 30, text: "Celebrity pastors." },
    { startSeconds: 95.2, text: "Amen." },
  ];

  it("finds the paragraph being spoken at a moment", () => {
    expect(currentParagraph(transcript, 31)).toBe(1);
    expect(currentParagraph(transcript, 3600)).toBe(2);
  });

  it("moves on to a paragraph the moment it starts", () => {
    expect(currentParagraph(transcript, 29.99)).toBe(0);
    expect(currentParagraph(transcript, 30)).toBe(1);
  });

  it("gives the first paragraph before its words begin", () => {
    expect(currentParagraph(transcript, 0)).toBe(0);
  });
});
