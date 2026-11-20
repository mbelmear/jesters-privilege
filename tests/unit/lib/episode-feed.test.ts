import { buildRecord } from "@/lib/build-manifest";
import type { Fetch } from "@/lib/download";
import {
  createEpisodeFeed,
  fileSnapshotStore,
  type FeedSourceAdapter,
  type SnapshotStore,
} from "@/lib/episode-feed";
import type { SpotifyKey } from "@/lib/spotify-lookup";

const SHOW = {
  "apple-podcasts":
    "https://podcasts.apple.com/us/podcast/jesters-privilege/id6830338936",
  spotify: "https://open.spotify.com/show/2pLnTqLzW9WCbYkcFkbbGr",
  youtube: "https://www.youtube.com/@jestersprivilege",
};

const CAPTIONED = "https://api.spreaker.com/episode/1";
const SAVED = "https://api.spreaker.com/episode/2";
const UNTRANSCRIBED = "https://api.spreaker.com/episode/3";
const HOST_VTT = "https://transcription.spreaker.com/1.vtt";

function item(guid: string, n: number, transcriptUrl?: string): string {
  return `<item>
<title>Episode ${n}</title>
<description><![CDATA[About Episode ${n}.]]></description>
<guid isPermaLink="false">${guid}</guid>
<pubDate>Thu, 0${n} Oct 2026 12:00:00 +0000</pubDate>
<enclosure url="https://example.com/${n}.mp3" length="1" type="audio/mpeg"/>
<itunes:duration>60</itunes:duration>
<itunes:episode>${n}</itunes:episode>
<itunes:episodeType>full</itunes:episodeType>
${transcriptUrl ? `<podcast:transcript url="${transcriptUrl}" type="text/vtt"/>` : ""}
</item>`;
}

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0" version="2.0">
<channel>
<title>Jester's Privilege</title>
<itunes:image href="https://example.com/show.png"/>
${item(CAPTIONED, 1, HOST_VTT)}
${item(SAVED, 2)}
${item(UNTRANSCRIBED, 3)}
</channel>
</rss>`;

const vtt = (words: string) =>
  `WEBVTT\n\n00:00:00.000 --> 00:00:05.000\n${words}\n`;

const APPLE_ANSWER = JSON.stringify({
  results: [
    { wrapperType: "track", kind: "podcast" },
    {
      wrapperType: "podcastEpisode",
      episodeGuid: SAVED,
      trackViewUrl:
        "https://podcasts.apple.com/us/podcast/two/id6830338936?i=2",
    },
  ],
});

function answer(body: string, status = 200): ReturnType<Fetch> {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Not Found",
    text: () => Promise.resolve(body),
  });
}

// A source held in memory: the feed above, the host's Transcript of Episode
// 1, the site's own of Episode 2, and Apple listing Episode 2.
function memorySource(
  overrides: Partial<FeedSourceAdapter> = {}
): FeedSourceAdapter {
  return {
    address: "https://www.spreaker.com/show/1/episodes/feed",
    feedText: () => Promise.resolve(FEED),
    hostTranscript: (url) =>
      url === HOST_VTT ? answer(vtt("From the host")) : answer("", 404),
    savedTranscript: (fileName) =>
      Promise.resolve(
        fileName === `${encodeURIComponent(SAVED)}.vtt`
          ? vtt("Saved by the site")
          : null
      ),
    appleLookup: () => answer(APPLE_ANSWER),
    ...overrides,
  };
}

// The snapshot file, kept in memory, with a way to put any text in it.
function memoryFiles() {
  const files = new Map<string, string>();
  const store = fileSnapshotStore(".feed-snapshot.json", {
    readFile: (path) => {
      const text = files.get(path);
      return text === undefined
        ? Promise.reject(new Error(`ENOENT: no such file, open '${path}'`))
        : Promise.resolve(text);
    },
    writeFile: (path, text) => {
      files.set(path, text);
      return Promise.resolve();
    },
  });
  return { files, store };
}

const quiet = () => {};

async function snapshotted(
  source: FeedSourceAdapter = memorySource(),
  store: SnapshotStore = memoryFiles().store
) {
  const feed = createEpisodeFeed(source, store, { listen: SHOW, warn: quiet });
  await store.write(await feed.lookUp({ warn: quiet }));
  // A fresh instance, as each of Next's workers is.
  return createEpisodeFeed(source, store, { listen: SHOW, warn: quiet });
}

describe("createEpisodeFeed", () => {
  it("reads back from the snapshot the Episodes the source had, newest first", async () => {
    const feed = await snapshotted();
    expect((await feed.episodes()).map(({ guid }) => guid)).toEqual([
      UNTRANSCRIBED,
      SAVED,
      CAPTIONED,
    ]);
  });

  it("reads back each Episode's Transcript: the host's, the site's own, or none", async () => {
    const feed = await snapshotted();
    const [untranscribed, saved, captioned] = await feed.episodes();
    expect((await feed.transcript(captioned))?.[0]?.text).toBe("From the host");
    expect((await feed.transcript(saved))?.[0]?.text).toBe("Saved by the site");
    expect(await feed.transcript(untranscribed)).toBeNull();
  });

  it("reads back each Episode's Listen links from the apps' lookups", async () => {
    const feed = await snapshotted();
    const [, saved, captioned] = await feed.episodes();
    expect(await feed.listenLinks(saved)).toEqual([
      {
        app: "apple-podcasts",
        href: "https://podcasts.apple.com/us/podcast/two/id6830338936?i=2",
      },
      { app: "spotify", href: SHOW.spotify },
      { app: "youtube", href: SHOW.youtube },
    ]);
    expect((await feed.listenLinks(captioned))[0]).toEqual({
      app: "apple-podcasts",
      href: SHOW["apple-podcasts"],
    });
  });

  it("records what the build knows: the newest Episode, who lists which, and which have Transcripts", async () => {
    const feed = await snapshotted();
    expect(await feed.record()).toEqual({
      newestEpisodeGuid: UNTRANSCRIBED,
      episodeListenLinks: { "apple-podcasts": [SAVED] },
      transcripts: [SAVED, CAPTIONED],
    });
  });

  it("records for the build what the feed check records afresh", async () => {
    const feed = createEpisodeFeed(memorySource(), memoryFiles().store, {
      listen: SHOW,
      warn: quiet,
    });
    const fresh = buildRecord(await feed.lookUp({ warn: quiet }));
    expect(await (await snapshotted()).record()).toEqual(fresh);
  });

  it("records no newest Episode for a feed that has none", async () => {
    const empty = FEED.replace(/<item>[\s\S]*<\/item>/, "");
    const feed = await snapshotted(
      memorySource({ feedText: () => Promise.resolve(empty) })
    );
    expect(await feed.record()).toEqual({
      newestEpisodeGuid: null,
      episodeListenLinks: {},
      transcripts: [],
    });
  });

  it("names the Episode it couldn't find a Transcript for while looking up", async () => {
    const warn = jest.fn();
    const feed = createEpisodeFeed(memorySource(), memoryFiles().store, {
      listen: SHOW,
      warn: quiet,
    });
    await feed.lookUp({ warn });
    expect(warn).toHaveBeenCalledWith(
      `Episode "Episode 3" has no Transcript yet: the feed links none, and the transcripts branch has no ${encodeURIComponent(UNTRANSCRIBED)}.vtt`
    );
  });

  it("names the Episode whose Listen link opens the show", async () => {
    const warn = jest.fn();
    const { store } = memoryFiles();
    const source = memorySource();
    await store.write(
      await createEpisodeFeed(source, store, {
        listen: SHOW,
        warn: quiet,
      }).lookUp({ warn: quiet })
    );
    const feed = createEpisodeFeed(source, store, { listen: SHOW, warn });
    await feed.listenLinks((await feed.episodes())[2]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/^Apple Podcasts doesn't list "Episode 1"/)
    );
  });

  it("reads the snapshot once, however many pages ask", async () => {
    const { store } = memoryFiles();
    const reads = jest.spyOn(store, "read");
    const feed = await snapshotted(memorySource(), store);
    reads.mockClear();
    await feed.episodes();
    await feed.record();
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it("fails, saying to run the snapshot script, when there is no snapshot", async () => {
    const feed = createEpisodeFeed(memorySource(), memoryFiles().store, {
      listen: SHOW,
      warn: quiet,
    });
    await expect(feed.episodes()).rejects.toThrow(
      "The feed snapshot .feed-snapshot.json can't be read, so run `npm run snapshot` before `next build` (npm run build does): ENOENT"
    );
  });

  it("fails the look-up when the feed can't be read, so the last good deploy stays live", async () => {
    const feed = createEpisodeFeed(
      memorySource({
        feedText: () => Promise.reject(new Error("Feed answered 503")),
      }),
      memoryFiles().store,
      { listen: SHOW, warn: quiet }
    );
    await expect(feed.lookUp()).rejects.toThrow("Feed answered 503");
  });

  it("reads the feed afresh, with no snapshot, for Transcribe", async () => {
    const feed = createEpisodeFeed(memorySource(), memoryFiles().store, {
      listen: SHOW,
      warn: quiet,
    });
    expect(await feed.freshEpisodes()).toHaveLength(3);
  });

  it("carries the source's address and whether its Episodes are draft", () => {
    const feed = createEpisodeFeed(
      memorySource({ draft: true }),
      memoryFiles().store,
      { listen: SHOW }
    );
    expect(feed.address).toBe("https://www.spreaker.com/show/1/episodes/feed");
    expect(feed.draft).toBe(true);
  });

  describe("Spotify", () => {
    function spotify(key: SpotifyKey) {
      return {
        key: jest.fn(() => key),
        fetch: jest.fn<ReturnType<Fetch>, Parameters<Fetch>>(() =>
          answer("", 404)
        ),
      };
    }

    it("is asked only of a source that has it", async () => {
      const feed = createEpisodeFeed(memorySource(), memoryFiles().store, {
        listen: SHOW,
        warn: quiet,
      });
      expect((await feed.lookUp({ warn: quiet })).lookups.spotify).toBe(
        undefined
      );
    });

    it("is left out when the source has no key to ask with", async () => {
      const access = spotify({ kind: "none" });
      const feed = createEpisodeFeed(
        memorySource({ spotify: access }),
        memoryFiles().store,
        { listen: SHOW, warn: quiet }
      );
      const warn = jest.fn();
      const { lookups } = await feed.lookUp({ warn });
      expect(lookups.spotify).toBeUndefined();
      expect(warn).not.toHaveBeenCalledWith(
        expect.stringMatching(/^Spotify lookup failed/)
      );
    });

    it("names the app whose lookup failed, once, while looking up", async () => {
      const access = spotify({ kind: "incomplete", reason: "no key" });
      const feed = createEpisodeFeed(
        memorySource({ spotify: access }),
        memoryFiles().store,
        { listen: SHOW, warn: quiet }
      );
      const warn = jest.fn();
      const { lookups } = await feed.lookUp({ warn });
      expect(lookups.spotify).toEqual({ kind: "failed", reason: "no key" });
      expect(
        warn.mock.calls.filter(([message]) =>
          String(message).startsWith("Spotify lookup failed")
        )
      ).toEqual([
        [
          "Spotify lookup failed, so no Episode has its Spotify Listen link: no key",
        ],
      ]);
    });
  });
});

describe("fileSnapshotStore", () => {
  it("names a snapshot that isn't JSON", async () => {
    const { files, store } = memoryFiles();
    files.set(".feed-snapshot.json", "{");
    await expect(store.read()).rejects.toThrow(
      "The feed snapshot .feed-snapshot.json isn't JSON"
    );
  });

  it("names a snapshot of the wrong shape", async () => {
    const { files, store } = memoryFiles();
    files.set(".feed-snapshot.json", JSON.stringify({ lookups: {} }));
    await expect(store.read()).rejects.toThrow(
      "The feed snapshot .feed-snapshot.json must hold the feed's text, its Transcripts and the apps' lookups"
    );
  });
});
