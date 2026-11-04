import {
  chooseFeedSource,
  feedUrl,
  loadFeedText,
  appleLookupFetch,
  savedTranscripts,
  transcriptFetch,
  type FeedIO,
  type FeedSources,
} from "./feed-source";

const url = "https://www.spreaker.com/show/6900001/episodes/feed";
const BRANCH =
  "https://raw.githubusercontent.com/mbelmear/jesters-privilege/transcripts/";

function io(overrides: Partial<FeedIO>): FeedIO {
  return {
    fetch: () => Promise.reject(new Error("fetch not expected")),
    readFile: () => Promise.reject(new Error("readFile not expected")),
    ...overrides,
  };
}

function response(status: number, statusText: string, body = "") {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: () => Promise.resolve(body),
  });
}

describe("loadFeedText", () => {
  it("reads the fixture while the real feed doesn't exist yet", async () => {
    const text = await loadFeedText(
      {
        kind: "fixture",
        path: "src/content/feed-fixture.xml",
        transcripts: "src/content/transcripts",
        savedTranscripts: "src/content/saved-transcripts",
        appleLookup: "src/content/apple-lookup-fixture.json",
        standsInFor: url,
        draft: true,
      },
      io({
        readFile: (path) =>
          Promise.resolve(
            path === "src/content/feed-fixture.xml" ? "<rss/>" : ""
          ),
      })
    );
    expect(text).toBe("<rss/>");
  });

  it("downloads the real feed", async () => {
    const text = await loadFeedText(
      { kind: "url", url, savedTranscripts: BRANCH },
      io({ fetch: (u) => response(200, "OK", u === url ? "<rss/>" : "") })
    );
    expect(text).toBe("<rss/>");
  });

  it("fails the build when the feed can't be reached", async () => {
    await expect(
      loadFeedText(
        { kind: "url", url, savedTranscripts: BRANCH },
        io({ fetch: () => Promise.reject(new TypeError("fetch failed")) })
      )
    ).rejects.toThrow(`Feed ${url} couldn't be reached: fetch failed`);
  });

  it("fails the build when the feed answers with an error", async () => {
    await expect(
      loadFeedText(
        { kind: "url", url, savedTranscripts: BRANCH },
        io({ fetch: () => response(503, "Service Unavailable", "<html/>") })
      )
    ).rejects.toThrow(`Feed ${url} answered 503 Service Unavailable`);
  });
});

describe("transcriptFetch", () => {
  const transcriptUrl =
    "https://transcription.spreaker.com/starship/abc/abc.vtt";

  it("reads the fixture's Transcripts from files named like Spreaker's", async () => {
    const fetch = transcriptFetch(
      {
        kind: "fixture",
        path: "src/content/feed-fixture.xml",
        transcripts: "src/content/transcripts",
        savedTranscripts: "src/content/saved-transcripts",
        appleLookup: "src/content/apple-lookup-fixture.json",
        standsInFor: url,
        draft: true,
      },
      io({
        readFile: (path) =>
          Promise.resolve(
            path === "src/content/transcripts/abc.vtt" ? "WEBVTT" : ""
          ),
      })
    );
    const answer = await fetch(transcriptUrl);
    expect(answer.ok).toBe(true);
    expect(await answer.text()).toBe("WEBVTT");
  });

  it("downloads the real feed's Transcripts", async () => {
    const fetch = transcriptFetch(
      { kind: "url", url, savedTranscripts: BRANCH },
      io({
        fetch: (u) => response(200, "OK", u === transcriptUrl ? "WEBVTT" : ""),
      })
    );
    expect(await (await fetch(transcriptUrl)).text()).toBe("WEBVTT");
  });
});

describe("savedTranscripts", () => {
  const branch =
    "https://raw.githubusercontent.com/mbelmear/jesters-privilege/transcripts/";
  const fileName = "https%3A%2F%2Fapi.spreaker.com%2Fepisode%2F1.vtt";
  const fixture = {
    kind: "fixture" as const,
    path: "src/content/feed-fixture.xml",
    transcripts: "src/content/transcripts",
    savedTranscripts: "src/content/saved-transcripts",
    appleLookup: "src/content/apple-lookup-fixture.json",
    standsInFor: url,
    draft: true as const,
  };
  const live = { kind: "url" as const, url, savedTranscripts: branch };

  it("reads the fixture's saved Transcripts from a folder standing in for the branch", async () => {
    const saved = savedTranscripts(
      fixture,
      io({
        readFile: (path) =>
          path === `src/content/saved-transcripts/${fileName}`
            ? Promise.resolve("WEBVTT")
            : Promise.reject(
                Object.assign(new Error(`ENOENT: no such file, ${path}`), {
                  code: "ENOENT",
                })
              ),
      })
    );
    expect(await saved(fileName)).toBe("WEBVTT");
    expect(await saved("other.vtt")).toBeNull();
  });

  it("fails when the fixture's folder can't be read", async () => {
    const saved = savedTranscripts(
      fixture,
      io({ readFile: () => Promise.reject(new Error("EACCES: denied")) })
    );
    await expect(saved(fileName)).rejects.toThrow("EACCES: denied");
  });

  it("downloads the real feed's saved Transcripts from the transcripts branch", async () => {
    const asked: string[] = [];
    const saved = savedTranscripts(
      live,
      io({
        fetch: (u) => {
          asked.push(u);
          return response(200, "OK", "WEBVTT");
        },
      })
    );
    expect(await saved(fileName)).toBe("WEBVTT");
    // The file name is a path segment of its own, percent signs and all.
    expect(asked).toEqual([
      `${branch}https%253A%252F%252Fapi.spreaker.com%252Fepisode%252F1.vtt`,
    ]);
  });

  it("finds none saved when the branch has no such file", async () => {
    const saved = savedTranscripts(
      live,
      io({ fetch: () => response(404, "Not Found") })
    );
    expect(await saved(fileName)).toBeNull();
  });

  it("fails when the branch can't be read", async () => {
    const saved = savedTranscripts(
      live,
      io({ fetch: () => response(503, "Service Unavailable") })
    );
    await expect(saved(fileName)).rejects.toThrow(
      `Saved Transcript ${branch}https%253A%252F%252Fapi.spreaker.com%252Fepisode%252F1.vtt answered 503 Service Unavailable`
    );
  });
});

describe("appleLookupFetch", () => {
  const lookupUrl =
    "https://itunes.apple.com/lookup?id=6830338936&entity=podcastEpisode&limit=200";

  it("answers the fixture's Apple lookup from a file, so tests never depend on Apple", async () => {
    const fetch = appleLookupFetch(
      {
        kind: "fixture",
        path: "src/content/feed-fixture.xml",
        transcripts: "src/content/transcripts",
        savedTranscripts: "src/content/saved-transcripts",
        appleLookup: "src/content/apple-lookup-fixture.json",
        standsInFor: url,
        draft: true,
      },
      io({
        readFile: (path) =>
          Promise.resolve(
            path === "src/content/apple-lookup-fixture.json" ? "{}" : ""
          ),
      })
    );
    expect(await (await fetch(lookupUrl)).text()).toBe("{}");
  });

  it("asks Apple for the real feed's Episodes", async () => {
    const fetch = appleLookupFetch(
      { kind: "url", url, savedTranscripts: BRANCH },
      io({ fetch: (u) => response(200, "OK", u === lookupUrl ? "{}" : "") })
    );
    expect(await (await fetch(lookupUrl)).text()).toBe("{}");
  });
});

describe("feedUrl", () => {
  it("is the feed the site reads, for podcast apps to subscribe to", () => {
    expect(feedUrl({ kind: "url", url, savedTranscripts: BRANCH })).toBe(url);
  });

  it("is the address the fixture stands in for, until the real feed exists", () => {
    expect(
      feedUrl({
        kind: "fixture",
        path: "src/content/feed-fixture.xml",
        transcripts: "src/content/transcripts",
        savedTranscripts: "src/content/saved-transcripts",
        appleLookup: "src/content/apple-lookup-fixture.json",
        standsInFor: "https://www.spreaker.com/show/1/episodes/feed",
        draft: true,
      })
    ).toBe("https://www.spreaker.com/show/1/episodes/feed");
  });
});

describe("chooseFeedSource", () => {
  const sources: FeedSources = {
    live: {
      kind: "url",
      url: "https://www.spreaker.com/show/7523831/episodes/feed",
      savedTranscripts: BRANCH,
    },
    fixture: {
      kind: "fixture",
      path: "src/content/feed-fixture.xml",
      transcripts: "src/content/transcripts",
      savedTranscripts: "src/content/saved-transcripts",
      appleLookup: "src/content/apple-lookup-fixture.json",
      standsInFor: "https://www.spreaker.com/show/7523831/episodes/feed",
      draft: true,
    },
    empty: {
      kind: "fixture",
      path: "src/content/feed-fixture-empty.xml",
      transcripts: "src/content/transcripts",
      savedTranscripts: "src/content/saved-transcripts",
      appleLookup: "src/content/apple-lookup-fixture.json",
      standsInFor: "https://www.spreaker.com/show/7523831/episodes/feed",
      draft: true,
    },
  };

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
