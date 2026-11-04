import {
  needingTranscripts,
  runTranscribe,
  transcriptionPrompt,
  type TranscribeIO,
} from "./transcribe";

const WEBVTT =
  "WEBVTT\n\n00:00:00.000 --> 00:00:04.000\nWelcome to the court.\n";

const linked = {
  guid: "ep-3",
  title: "Mockery and the Prophets",
  audioUrl: "https://example.com/3.mp3",
  transcriptUrl: "https://transcription.spreaker.com/starship/a/a.vtt",
};
const second = {
  guid: "ep-2",
  title: "The Holy Fool",
  audioUrl: "https://example.com/2.mp3",
  transcriptUrl: null,
};
const first = {
  guid: "ep-1",
  title: "Celebrity Pastors",
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

describe("runTranscribe", () => {
  it("transcribes each Episode without a Transcript once, saving it as WebVTT", async () => {
    const { io, files, log } = branch(
      {},
      { [second.audioUrl]: WEBVTT, [first.audioUrl]: WEBVTT }
    );
    expect(await runTranscribe([linked, second, first], io)).toBe(0);
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
    expect(await runTranscribe([linked, second, first], io)).toBe(0);
    expect(transcribed).toEqual([]);
    expect(files["ep-2.vtt"]).toBe(fixed);
    expect(log).toEqual(["::notice::Every Episode has a Transcript"]);
  });

  it("leaves the Episode without one, naming why, when transcribing fails, and fails the run", async () => {
    const { io, files, log } = branch({}, { [first.audioUrl]: WEBVTT });
    expect(await runTranscribe([second, first], io)).toBe(1);
    expect(files).toEqual({ "ep-1.vtt": WEBVTT });
    expect(log).toEqual([
      '::error::"The Holy Fool" is left without a Transcript: whisper-cli exited with 1',
      '::notice::Saved the Transcript of "Celebrity Pastors" as ep-1.vtt',
    ]);
  });

  it("saves nothing the Transcript module can't read", async () => {
    const { io, files, log } = branch({}, { [first.audioUrl]: "WEBVTT\n" });
    expect(await runTranscribe([first], io)).toBe(1);
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
