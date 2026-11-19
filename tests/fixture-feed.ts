// The Episode feed as Jest's tests read it: the fixture, through the same
// module a build uses (src/lib/episode-feed.ts), with its snapshot held in
// memory instead of `.feed-snapshot.json`. jest.setup.ts puts it in place of
// src/content/feed.ts, so a test that renders a page needs no build before it.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { LIVE_FEED_URL, site } from "@/content/site";
import {
  createEpisodeFeed,
  fileSnapshotStore,
  type EpisodeFeed,
  type FeedSourceAdapter,
  type SnapshotStore,
} from "@/lib/episode-feed";
import { fixtureSource } from "@/lib/feed-source";
import { srcDir } from "./paths";

// src/content/feed.ts's FEED_SNAPSHOT; importing it here would load the
// module this file stands in for.
const FEED_SNAPSHOT = ".feed-snapshot.json";

// The snapshot file, kept in memory.
export function memorySnapshotStore(): SnapshotStore {
  const files = new Map<string, string>();
  return fileSnapshotStore(FEED_SNAPSHOT, {
    readFile: async (path) => {
      const text = files.get(path);
      if (text === undefined) {
        throw Object.assign(new Error(`ENOENT: no such file, open '${path}'`), {
          code: "ENOENT",
        });
      }
      return text;
    },
    writeFile: async (path, text) => {
      files.set(path, text);
    },
  });
}

export function fixtureSourceForTests(): FeedSourceAdapter {
  return fixtureSource(
    {
      path: join(srcDir, "content/feed-fixture.xml"),
      transcripts: join(srcDir, "content/transcripts"),
      savedTranscripts: join(srcDir, "content/saved-transcripts"),
      appleLookup: join(srcDir, "content/apple-lookup-fixture.json"),
      standsInFor: LIVE_FEED_URL,
    },
    (path) => readFile(path, "utf8")
  );
}

// The fixture's feed, its snapshot taken in memory the first time a test
// reads it. The snapshot's log (the bonus Episode has no Transcript) is the
// build's, not a page's, so it stays quiet here; tests/unit/content/
// transcripts.test.ts reads it from lookUp itself.
export function fixtureFeed(): EpisodeFeed {
  const source = fixtureSourceForTests();
  const store = memorySnapshotStore();
  let taken: Promise<void> | undefined;
  const snapshotted: SnapshotStore = {
    read: async () => {
      taken ??= createEpisodeFeed(source, store, { listen: site.listen })
        .lookUp({ warn: () => {} })
        .then((snapshot) => store.write(snapshot));
      await taken;
      return store.read();
    },
    write: (snapshot) => store.write(snapshot),
  };
  return createEpisodeFeed(source, snapshotted, { listen: site.listen });
}

// src/content/feed.ts, built on the fixture's feed.
export function contentFeed(
  feed: EpisodeFeed = fixtureFeed()
): typeof import("@/content/feed") {
  return {
    FEED_SNAPSHOT,
    feedSnapshot: memorySnapshotStore(),
    feed,
    getEpisodes: () => feed.episodes(),
    getTranscript: (episode) => feed.transcript(episode),
    getEpisodeListenLinks: (episode) => feed.listenLinks(episode),
    getListedEpisodes: () => feed.listedEpisodes(),
    getTranscribedEpisodes: () => feed.transcribedEpisodes(),
  };
}
