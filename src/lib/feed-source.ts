import { basename, join } from "node:path";
import { downloadText, type Fetch } from "./download";

// Where the Feed comes from. Until Episode 1 is published, a fixture shaped like
// the Spreaker feed stands in, with its Transcripts in a folder beside it; its
// Episodes are draft copy. `standsInFor` is the feed address it pretends to
// be, which the page head links to.
export type FeedSource =
  | {
      kind: "fixture";
      path: string;
      transcripts: string;
      standsInFor: string;
      draft: true;
    }
  | { kind: "url"; url: string };

// The feeds a build can read: the live Spreaker feed, and fixtures shaped like
// it for tests (one with Episodes, one without).
export type FeedSources = {
  live: Extract<FeedSource, { kind: "url" }>;
  fixture: FeedSource;
  empty: FeedSource;
};

// Which feed this build reads, from the environment. Builds read the fixture
// unless FEED says otherwise, so tests never depend on Spreaker; the deploy
// sets FEED=live, and a production build without it fails rather than
// publishing the fixture.
export function chooseFeedSource(
  env: { FEED?: string; SITE_ENV?: string },
  sources: FeedSources
): FeedSource {
  const [chosen, name] = feedNamed(env.FEED, sources);
  if (env.SITE_ENV === "production" && chosen !== sources.live) {
    throw new Error(
      `A production build must read the live feed (FEED=live), not ${name}`
    );
  }
  return chosen;
}

function feedNamed(
  feed: string | undefined,
  sources: FeedSources
): [FeedSource, string] {
  switch (feed) {
    case "live":
      return [sources.live, "the live feed"];
    case "empty":
      return [sources.empty, "the empty fixture"];
    case undefined:
    case "":
      return [sources.fixture, "the fixture"];
    default:
      throw new Error(
        `FEED is "${feed}"; expected live, empty, or unset for the fixture`
      );
  }
}

export type FeedIO = {
  fetch: Fetch;
  readFile: (path: string) => Promise<string>;
};

// The feed's public address, which podcast apps subscribe to.
export function feedUrl(source: FeedSource): string {
  switch (source.kind) {
    case "fixture":
      return source.standsInFor;
    case "url":
      return source.url;
    default: {
      const unhandled: never = source;
      return unhandled;
    }
  }
}

// Any failure here fails the build, so the last good deploy stays live (ADR 0001).
export async function loadFeedText(
  source: FeedSource,
  io: FeedIO
): Promise<string> {
  switch (source.kind) {
    case "fixture":
      return io.readFile(source.path);
    case "url":
      return downloadText("Feed", source.url, io.fetch);
    default: {
      const unhandled: never = source;
      return unhandled;
    }
  }
}

// How to fetch the Transcripts the Feed links to. The fixture's are files named
// like the ones Spreaker serves.
export function transcriptFetch(source: FeedSource, io: FeedIO): Fetch {
  switch (source.kind) {
    case "fixture":
      return async (url) => {
        const text = await io.readFile(
          join(source.transcripts, basename(new URL(url).pathname))
        );
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => text,
        };
      };
    case "url":
      return io.fetch;
    default: {
      const unhandled: never = source;
      return unhandled;
    }
  }
}
