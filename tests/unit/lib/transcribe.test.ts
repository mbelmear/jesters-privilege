import {
  needingTranscripts,
  planStep,
  planTranscripts,
  runTranscribe,
  transcriptionPrompt,
  type TranscribeIO,
} from "@/lib/transcribe";

const WEBVTT =
  "WEBVTT\n\n00:00:00.000 --> 00:00:04.000\nWelcome to the court.\n";

const now = new Date("2026-11-20T12:00:00Z");
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

const linked = {
  guid: "ep-3",
  title: "Mockery and the Prophets",
  publishedAt: daysAgo(1),
  audioUrl: "https://example.com/3.mp3",
  transcriptUrl: "https://transcription.spreaker.com/starship/a/a.vtt",
};
const second = {
  guid: "ep-2",
  title: "The Holy Fool",
  publishedAt: daysAgo(2),
  audioUrl: "https://example.com/2.mp3",
  transcriptUrl: null,
};
const first = {
  guid: "ep-1",
  title: "Celebrity Pastors",
  publishedAt: daysAgo(3),
  audioUrl: "https://example.com/1.mp3",
  transcriptUrl: null,
};

// A transcripts branch holding `files`, and a transcriber that answers from
// `heard` by audio address, throwing for any it doesn't know.
function branch(
  files: Record<string, string>,
  heard: Record<string, string> = {}
) {
  const log: string[] = [];
  const transcribed: string[] = [];
  const io: TranscribeIO = {
    isSaved: async (fileName) => fileName in files,
    transcribe: async (episode) => {
      transcribed.push(episode.guid);
      const text = heard[episode.audioUrl];
      if (text === undefined) throw new Error("whisper-cli exited with 1");
      return text;
    },
    save: async (fileName, text) => {
      files[fileName] = text;
    },
    log: (line) => log.push(line),
  };
  return { io, files, log, transcribed };
}

describe("needingTranscripts", () => {
  it("lists the Episodes with neither a Transcript the feed links nor a saved one, newest first", async () => {
    const { io } = branch({ "ep-1.vtt": WEBVTT });
    expect(await needingTranscripts([linked, second, first], io)).toEqual([
      second,
    ]);
  });
});

describe("planTranscripts", () => {
  const fresh = { ...second, publishedAt: daysAgo(6) };
  const old = { ...first, publishedAt: daysAgo(8) };

  it("picks an Episode in its first week and refuses an older one on a scheduled run", async () => {
    const { io } = branch({});
    expect(
      await planTranscripts([fresh, old], io, { now, anyAge: false })
    ).toEqual({ transcribe: [fresh], refused: [old] });
  });

  it("picks an older Episode on a run started by hand", async () => {
    const { io } = branch({});
    expect(
      await planTranscripts([fresh, old], io, { now, anyAge: true })
    ).toEqual({ transcribe: [fresh, old], refused: [] });
  });

  it("never picks or refuses an Episode with a saved file, however old", async () => {
    const ancient = { ...first, publishedAt: daysAgo(400) };
    const { io } = branch({ "ep-1.vtt": WEBVTT });
    for (const anyAge of [false, true]) {
      expect(await planTranscripts([ancient], io, { now, anyAge })).toEqual({
        transcribe: [],
        refused: [],
      });
    }
  });
});

describe("planStep", () => {
  const fresh = { ...second, publishedAt: daysAgo(6) };
  const old = { ...first, publishedAt: daysAgo(8) };
  const refusal =
    '::error::"Celebrity Pastors" (ep-1) is older than 7 days and has no Transcript saved. Only a run started from Run workflow on Transcribe transcribes an Episode that old; press it to transcribe this one on purpose.';

  it("fails, naming what it refused, when there's nothing new, so Whisper isn't built", () => {
    expect(planStep({ transcribe: [], refused: [old] })).toEqual({
      needed: false,
      lines: [refusal],
      exitCode: 1,
    });
  });

  it("passes the refused ones on to the Transcribe step when there's something new", () => {
    expect(planStep({ transcribe: [fresh], refused: [old] })).toEqual({
      needed: true,
      lines: ['::notice::"The Holy Fool" needs a Transcript'],
      exitCode: 0,
    });
  });

  it("passes with nothing to do", () => {
    expect(planStep({ transcribe: [], refused: [] })).toEqual({
      needed: false,
      lines: [],
      exitCode: 0,
    });
  });
});

describe("runTranscribe", () => {
  const scheduled = { now, anyAge: false };

  it("transcribes each Episode without a Transcript once, saving it as WebVTT", async () => {
    const { io, files, log } = branch(
      {},
      { [second.audioUrl]: WEBVTT, [first.audioUrl]: WEBVTT }
    );
    expect(await runTranscribe([linked, second, first], io, scheduled)).toBe(0);
    expect(files).toEqual({ "ep-2.vtt": WEBVTT, "ep-1.vtt": WEBVTT });
    expect(log).toEqual([
      '::notice::Saved the Transcript of "The Holy Fool" as ep-2.vtt',
      '::notice::Saved the Transcript of "Celebrity Pastors" as ep-1.vtt',
    ]);
  });

  it("never transcribes an Episode again, so a hand fix to its file sticks", async () => {
    const fixed = WEBVTT.replace("court", "Court of the King");
    const { io, files, transcribed, log } = branch(
      { "ep-2.vtt": fixed, "ep-1.vtt": WEBVTT },
      { [second.audioUrl]: WEBVTT, [first.audioUrl]: WEBVTT }
    );
    expect(await runTranscribe([linked, second, first], io, scheduled)).toBe(0);
    expect(transcribed).toEqual([]);
    expect(files["ep-2.vtt"]).toBe(fixed);
    expect(log).toEqual(["::notice::Every Episode has a Transcript"]);
  });

  it("leaves the Episode without one, naming why, when transcribing fails, and fails the run", async () => {
    const { io, files, log } = branch({}, { [first.audioUrl]: WEBVTT });
    expect(await runTranscribe([second, first], io, scheduled)).toBe(1);
    expect(files).toEqual({ "ep-1.vtt": WEBVTT });
    expect(log).toEqual([
      '::error::"The Holy Fool" is left without a Transcript: whisper-cli exited with 1',
      '::notice::Saved the Transcript of "Celebrity Pastors" as ep-1.vtt',
    ]);
  });

  it("transcribes a new Episode, refuses an older one by name, and fails the run", async () => {
    const old = { ...first, publishedAt: daysAgo(8) };
    const { io, files, transcribed, log } = branch(
      {},
      { [second.audioUrl]: WEBVTT, [first.audioUrl]: WEBVTT }
    );
    expect(await runTranscribe([second, old], io, scheduled)).toBe(1);
    expect(transcribed).toEqual(["ep-2"]);
    expect(files).toEqual({ "ep-2.vtt": WEBVTT });
    expect(log).toEqual([
      '::error::"Celebrity Pastors" (ep-1) is older than 7 days and has no Transcript saved. Only a run started from Run workflow on Transcribe transcribes an Episode that old; press it to transcribe this one on purpose.',
      '::notice::Saved the Transcript of "The Holy Fool" as ep-2.vtt',
    ]);
  });

  it("saves nothing the Transcript module can't read", async () => {
    const { io, files, log } = branch({}, { [first.audioUrl]: "WEBVTT\n" });
    expect(await runTranscribe([first], io, scheduled)).toBe(1);
    expect(files).toEqual({});
    expect(log).toEqual([
      '::error::"Celebrity Pastors" is left without a Transcript: Transcript has no cues with words in them',
    ]);
  });
});

describe("transcriptionPrompt", () => {
  it("names the show's hard names, so Whisper spells them right", () => {
    expect(
      transcriptionPrompt(["Michael", "Dan", "Aaron"], ["Stańczyk", "Bozeman"])
    ).toBe(
      "Jester's Privilege, with Michael, Dan, and Aaron. Stańczyk, Bozeman."
    );
  });
});
