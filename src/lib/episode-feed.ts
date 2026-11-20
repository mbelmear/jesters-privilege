// The Episode feed: what the build knows of the show's Episodes, each
// Episode's Transcript, and its Listen links. It asks a source (the live feed
// or a fixture, each an adapter) once per build, before `next build`, and
// saves the answer as one snapshot (`lookUp`, written by `npm run snapshot`).
// Pages and the build manifest then read only that snapshot: Next renders
// them in several worker processes, and a network read made in each could
// succeed in one and fail in another, leaving a page that disagrees with the
// manifest the feed check compares against (CODING_STANDARDS.md).
import { buildRecord, type BuildRecord } from "./build-manifest";
import type { Site } from "./content";
import { errorMessage, type Fetch } from "./download";
import {
  APP_NAMES,
  EPISODE_LISTEN_APPS,
  episodeListenLinks,
  lookUpApple,
  parseLookups,
  serializeLookups,
  type AppLookup,
  type EpisodeListenApp,
  type EpisodeListenLink,
  type Lookups,
} from "./episode-listen-links";
import { parseFeed, type Episode } from "./feed";
import { lookUpSpotify, type SpotifyKey } from "./spotify-lookup";
import {
  loadTranscriptTexts,
  parseTranscript,
  parseTranscriptTexts,
  serializeTranscriptTexts,
  type Transcript,
  type TranscriptTexts,
} from "./transcript";

// Where the feed and what it links to come from (src/lib/feed-source.ts).
export type FeedSourceAdapter = {
  // The feed's public address, which podcast apps subscribe to and the page
  // head links to.
  readonly address: string;
  // A fixture's Episodes are draft copy.
  readonly draft?: true;
  // The feed's RSS. Throws when it can't be had, failing the build so the
  // last good deploy stays live (ADR 0001).
  feedText(): Promise<string>;
  // Downloads the Transcript the feed links to.
  hostTranscript: Fetch;
  // The site's own Transcript saved under this file name on the
  // `transcripts` branch (ADR 0003), or null when none is saved. Throws when
  // the branch can't be read.
  savedTranscript(fileName: string): Promise<string | null>;
  // Answers Apple's lookup of the show's Episodes.
  appleLookup: Fetch;
  // Asks Spotify for the show's Episodes; only the live feed can.
  spotify?: SpotifyAccess;
};

export type SpotifyAccess = {
  fetch: Fetch;
  // The key to ask with. A run that requires one counts going without as a
  // failed lookup; the source decides which runs do (src/content/feed.ts).
  key(): SpotifyKey;
};

// Everything a build reads of the feed, asked once.
export type FeedSnapshot = {
  feed: string;
  transcripts: TranscriptTexts;
  lookups: Lookups;
};

export type SnapshotStore = {
  read(): Promise<FeedSnapshot>;
  write(snapshot: FeedSnapshot): Promise<void>;
};

export type EpisodeFeed = {
  readonly address: string;
  readonly draft?: true;
  // Every Episode, newest first, from the snapshot.
  episodes(): Promise<Episode[]>;
  // An Episode's Transcript, or null when it has none (the snapshot's log
  // said why).
  transcript(episode: Pick<Episode, "guid">): Promise<Transcript | null>;
  // The Episode's Listen link in each app the show is on; the feed's `warn`
  // names each one that opens the show for want of the Episode's own.
  listenLinks(
    episode: Pick<Episode, "guid" | "title">
  ): Promise<EpisodeListenLink[]>;
  // The build record of the snapshot, which the build manifest publishes.
  record(): Promise<BuildRecord>;
  // Asks the source afresh for everything a build reads. Throws when the
  // feed can't be read or breaks a rule; a Transcript or lookup that fails
  // never does, and `warn` names each Episode left without its Transcript
  // and each app whose lookup failed.
  lookUp(options?: { warn?: (message: string) => void }): Promise<FeedSnapshot>;
  // The feed's Episodes read afresh, for a run with no snapshot that needs
  // nothing else (Transcribe).
  freshEpisodes(): Promise<Episode[]>;
};

export function createEpisodeFeed(
  source: FeedSourceAdapter,
  store: SnapshotStore,
  {
    listen,
    warn = (message) => console.warn(message),
  }: {
    listen: Site["listen"];
    warn?: (message: string) => void;
  }
): EpisodeFeed {
  let snapshot: Promise<FeedSnapshot> | undefined;
  const read = () => (snapshot ??= store.read());
  let episodes: Promise<Episode[]> | undefined;
  const readEpisodes = () =>
    (episodes ??= read().then(({ feed }) => parseFeed(feed)));

  async function lookUpApps(found: readonly Episode[]): Promise<Lookups> {
    const lookups: { [A in EpisodeListenApp]?: AppLookup } = {};
    const apple = listen["apple-podcasts"];
    if (apple) {
      lookups["apple-podcasts"] = await lookUpApple(apple, source.appleLookup);
    }
    const spotify = listen.spotify;
    if (spotify && source.spotify) {
      lookups.spotify = await lookUpSpotify(
        spotify,
        source.spotify.key(),
        found,
        source.spotify.fetch
      );
    }
    return lookups;
  }

  return {
    address: source.address,
    draft: source.draft,
    episodes: async () => [...(await readEpisodes())],
    async transcript(episode) {
      const text = (await read()).transcripts.get(episode.guid);
      return text === undefined ? null : parseTranscript(text);
    },
    async listenLinks(episode) {
      return episodeListenLinks(episode, listen, (await read()).lookups, warn);
    },
    record: async () => buildRecord(await read()),
    async lookUp({ warn: lookUpWarn = warn } = {}) {
      const feed = await source.feedText();
      const found = parseFeed(feed);
      const [transcripts, lookups] = await Promise.all([
        loadTranscriptTexts(found, {
          fetch: source.hostTranscript,
          saved: (fileName) => source.savedTranscript(fileName),
          warn: lookUpWarn,
        }),
        lookUpApps(found),
      ]);
      for (const app of EPISODE_LISTEN_APPS) {
        const lookup = lookups[app];
        if (lookup?.kind === "failed") {
          lookUpWarn(
            `${APP_NAMES[app]} lookup failed, so no Episode has its ${APP_NAMES[app]} Listen link: ${lookup.reason}`
          );
        }
      }
      return { feed, transcripts, lookups };
    },
    freshEpisodes: async () => parseFeed(await source.feedText()),
  };
}

// The snapshot as a file: `.feed-snapshot.json` in a build (gitignored).
export function fileSnapshotStore(
  path: string,
  io: {
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, text: string) => Promise<void>;
  }
): SnapshotStore {
  const named = `The feed snapshot ${path}`;
  return {
    async read() {
      let text: string;
      try {
        text = await io.readFile(path);
      } catch (error: unknown) {
        throw new Error(
          `${named} can't be read, so run \`npm run snapshot\` before \`next build\` (npm run build does): ${errorMessage(error)}`
        );
      }
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch {
        throw new Error(`${named} isn't JSON`);
      }
      return parseSnapshot(named, value);
    },
    write: (snapshot) =>
      io.writeFile(
        path,
        JSON.stringify({
          feed: snapshot.feed,
          transcripts: serializeTranscriptTexts(snapshot.transcripts),
          lookups: serializeLookups(snapshot.lookups),
        })
      ),
  };
}

function parseSnapshot(named: string, value: unknown): FeedSnapshot {
  if (
    typeof value !== "object" ||
    value === null ||
    !("feed" in value) ||
    typeof value.feed !== "string" ||
    !("transcripts" in value) ||
    !("lookups" in value)
  ) {
    throw new Error(
      `${named} must hold the feed's text, its Transcripts and the apps' lookups`
    );
  }
  return {
    feed: value.feed,
    transcripts: parseTranscriptTexts(value.transcripts),
    lookups: parseLookups(value.lookups),
  };
}
