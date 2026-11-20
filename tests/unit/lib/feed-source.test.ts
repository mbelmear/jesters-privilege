import type { Fetch } from "@/lib/download";
import { chooseFeedSource, fixtureSource, liveSource } from "@/lib/feed-source";

const url = "https://www.spreaker.com/show/6900001/episodes/feed";
const BRANCH =
  "https://raw.githubusercontent.com/mbelmear/jesters-privilege/transcripts/";

function response(status: number, statusText: string, body = "") {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: () => Promise.resolve(body),
  });
}

const notFetched: Fetch = () => Promise.reject(new Error("fetch not expected"));

describe("liveSource", () => {
  const live = (fetch: Fetch = notFetched) =>
    liveSource(
      {
        url,
        savedTranscripts: BRANCH,
        spotifyKey: () => ({ kind: "none" }),
      },
      fetch
    );

  it("is the feed the site reads, for podcast apps to subscribe to", () => {
    expect(live().address).toBe(url);
    expect(live().draft).toBeUndefined();
  });

  it("downloads the real feed", async () => {
    const source = live((u) => response(200, "OK", u === url ? "<rss/>" : ""));
    expect(await source.feedText()).toBe("<rss/>");
  });

  it("fails the build when the feed can't be reached", async () => {
    await expect(
      live(() => Promise.reject(new TypeError("fetch failed"))).feedText()
    ).rejects.toThrow(`Feed ${url} couldn't be reached: fetch failed`);
  });

  it("fails the build when the feed answers with an error", async () => {
    await expect(
      live(() => response(503, "Service Unavailable", "<html/>")).feedText()
    ).rejects.toThrow(`Feed ${url} answered 503 Service Unavailable`);
  });

  it("downloads the real feed's Transcripts and asks Apple and Spotify itself", async () => {
    const transcriptUrl =
      "https://transcription.spreaker.com/starship/abc/abc.vtt";
    const source = live((u) =>
      response(200, "OK", u === transcriptUrl ? "WEBVTT" : "{}")
    );
    expect(await (await source.hostTranscript(transcriptUrl)).text()).toBe(
      "WEBVTT"
    );
    expect(
      await (await source.appleLookup("https://itunes.apple.com/lookup")).text()
    ).toBe("{}");
    expect(source.spotify?.key()).toEqual({ kind: "none" });
  });

  describe("savedTranscript", () => {
    const fileName = "https%3A%2F%2Fapi.spreaker.com%2Fepisode%2F1.vtt";
    const onBranch = `${BRANCH}https%253A%252F%252Fapi.spreaker.com%252Fepisode%252F1.vtt`;

    it("downloads the site's own Transcript from the transcripts branch", async () => {
      const asked: string[] = [];
      const source = live((u) => {
        asked.push(u);
        return response(200, "OK", "WEBVTT");
      });
      expect(await source.savedTranscript(fileName)).toBe("WEBVTT");
      // The file name is a path segment of its own, percent signs and all.
      expect(asked).toEqual([onBranch]);
    });

    it("finds none saved when the branch has no such file", async () => {
      const source = live(() => response(404, "Not Found"));
      expect(await source.savedTranscript(fileName)).toBeNull();
    });

    it("fails when the branch answers with an error", async () => {
      const source = live(() => response(503, "Service Unavailable"));
      await expect(source.savedTranscript(fileName)).rejects.toThrow(
        `Saved Transcript ${onBranch} answered 503 Service Unavailable`
      );
    });

    it("fails when the branch can't be reached", async () => {
      const source = live(() => Promise.reject(new TypeError("fetch failed")));
      await expect(source.savedTranscript(fileName)).rejects.toThrow(
        `Saved Transcript ${onBranch} couldn't be reached: fetch failed`
      );
    });
  });
});

describe("fixtureSource", () => {
  const missing = (path: string) =>
    Promise.reject(
      Object.assign(new Error(`ENOENT: no such file, ${path}`), {
        code: "ENOENT",
      })
    );

  const fixture = (
    files: Record<string, string>,
    readFile = (path: string) =>
      path in files ? Promise.resolve(files[path]) : missing(path)
  ) =>
    fixtureSource(
      {
        path: "src/content/feed-fixture.xml",
        transcripts: "src/content/transcripts",
        savedTranscripts: "src/content/saved-transcripts",
        appleLookup: "src/content/apple-lookup-fixture.json",
        standsInFor: url,
      },
      readFile
    );

  it("stands in for the real feed's address, and its Episodes are draft", () => {
    const source = fixture({});
    expect(source.address).toBe(url);
    expect(source.draft).toBe(true);
  });

  it("reads the fixture feed, so tests never depend on Spreaker", async () => {
    const source = fixture({ "src/content/feed-fixture.xml": "<rss/>" });
    expect(await source.feedText()).toBe("<rss/>");
  });

  it("reads the fixture's Transcripts from files named like Spreaker's", async () => {
    const source = fixture({ "src/content/transcripts/abc.vtt": "WEBVTT" });
    const answer = await source.hostTranscript(
      "https://transcription.spreaker.com/starship/abc/abc.vtt"
    );
    expect(answer.ok).toBe(true);
    expect(await answer.text()).toBe("WEBVTT");
  });

  it("reads its saved Transcripts from a folder standing in for the branch", async () => {
    const fileName = "https%3A%2F%2Fapi.spreaker.com%2Fepisode%2F1.vtt";
    const source = fixture({
      [`src/content/saved-transcripts/${fileName}`]: "WEBVTT",
    });
    expect(await source.savedTranscript(fileName)).toBe("WEBVTT");
    expect(await source.savedTranscript("other.vtt")).toBeNull();
  });

  it("fails when its saved Transcripts' folder can't be read", async () => {
    const source = fixture({}, () =>
      Promise.reject(new Error("EACCES: denied"))
    );
    await expect(source.savedTranscript("any.vtt")).rejects.toThrow(
      "EACCES: denied"
    );
  });

  it("answers Apple's lookup from a file, so tests never depend on Apple, and never asks Spotify", async () => {
    const source = fixture({ "src/content/apple-lookup-fixture.json": "{}" });
    expect(
      await (await source.appleLookup("https://itunes.apple.com/lookup")).text()
    ).toBe("{}");
    expect(source.spotify).toBeUndefined();
  });
});

describe("chooseFeedSource", () => {
  const sources = { live: "live", fixture: "fixture", empty: "empty" };

  it("builds from the fixture by default, so tests never depend on Spreaker", () => {
    expect(chooseFeedSource({}, sources)).toBe(sources.fixture);
  });

  it("builds from Spreaker when the deploy asks for the live feed", () => {
    expect(chooseFeedSource({ FEED: "live" }, sources)).toBe(sources.live);
  });

  it("builds with no Episodes to test the coming-soon state", () => {
    expect(chooseFeedSource({ FEED: "empty" }, sources)).toBe(sources.empty);
  });

  it("refuses a production build that isn't reading the live feed", () => {
    expect(() => chooseFeedSource({ SITE_ENV: "production" }, sources)).toThrow(
      "A production build must read the live feed (FEED=live), not the fixture"
    );
    expect(() =>
      chooseFeedSource({ SITE_ENV: "production", FEED: "empty" }, sources)
    ).toThrow(
      "A production build must read the live feed (FEED=live), not the empty fixture"
    );
    expect(
      chooseFeedSource({ SITE_ENV: "production", FEED: "live" }, sources)
    ).toBe(sources.live);
  });

  it("reads the fixture when asked by name", () => {
    expect(chooseFeedSource({ FEED: "fixture" }, sources)).toBe(
      sources.fixture
    );
  });

  it("refuses a FEED it doesn't know rather than quietly using the fixture", () => {
    expect(() => chooseFeedSource({ FEED: "liev" }, sources)).toThrow(
      'FEED is "liev"; expected one of live, fixture, empty (unset means fixture)'
    );
  });
});
