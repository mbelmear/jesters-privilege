// The build manifest is published at BUILD_MANIFEST_PATH on every deploy. The
// feed check (ADR 0004) reads it from the live site and rebuilds when the
// feed's newest Episode differs from the one recorded here (ADR 0001), or when
// an Episode has gained a Transcript or an Episode Listen link since (ADR 0003).
// Both sides build their record with `buildRecord`, so the check compares
// exactly what a fresh build would publish.
import type { FeedSnapshot } from "./episode-feed";
import {
  APP_NAMES,
  EPISODE_LISTEN_APPS,
  gainedListenLinks,
  listedEpisodes,
  type EpisodeListenApp,
  type ListedEpisodes,
} from "./episode-listen-links";
import { parseFeed } from "./feed";

export const BUILD_MANIFEST_PATH = "/build-manifest.json";

// The build record: what a build knows of the feed's Episodes that decides
// whether the live site is behind.
export type BuildRecord = {
  // The newest Episode's feed GUID, or null when the feed had no Episodes.
  newestEpisodeGuid: string | null;
  // The Episodes the deploy had Episode Listen links for, by app.
  episodeListenLinks: ListedEpisodes;
  // The Episodes the deploy had Transcripts for, by feed GUID, newest first.
  transcripts: string[];
};

export type BuildManifest = BuildRecord & {
  // The git commit the deploy was built from, or null for a local build.
  commit: string | null;
};

// The record of a build that read this snapshot.
export function buildRecord({
  feed,
  transcripts,
  lookups,
}: FeedSnapshot): BuildRecord {
  const episodes = parseFeed(feed);
  return {
    newestEpisodeGuid: episodes[0]?.guid ?? null,
    episodeListenLinks: listedEpisodes(episodes, lookups),
    transcripts: episodes
      .map(({ guid }) => guid)
      .filter((guid) => transcripts.has(guid)),
  };
}

// What a rebuild brings the live site. A new newest Episode is the one cause
// after which a feed check starts Transcribe (ADR 0004).
export type RebuildCause = "new-episode" | "listen-links" | "transcripts";

// Whether the live site is behind, and why.
export type FeedCheck =
  | { rebuild: false; reason: string }
  | { rebuild: true; cause: RebuildCause; reason: string };

// Compares the live site's record with a fresh one: rebuild when the feed's
// newest Episode differs (ADR 0001), or when an Episode has gained an Episode
// Listen link or a Transcript (ADR 0003). One lost, as when a lookup or
// download failed this time, never rebuilds.
export function compareRecords(
  live: BuildRecord,
  fresh: BuildRecord
): FeedCheck {
  if (live.newestEpisodeGuid !== fresh.newestEpisodeGuid) {
    return {
      rebuild: true,
      cause: "new-episode",
      reason: `The feed's newest Episode (${fresh.newestEpisodeGuid}) isn't on the live site, which has ${live.newestEpisodeGuid}`,
    };
  }
  const gained = gainedListenLinks(
    live.episodeListenLinks,
    fresh.episodeListenLinks
  );
  if (gained.length > 0) {
    const named = gained
      .map(({ app, guid }) => `${guid} in ${APP_NAMES[app]}`)
      .join(", ");
    return {
      rebuild: true,
      cause: "listen-links",
      reason: `Episodes have gained Episode Listen links since the live site was built: ${named}`,
    };
  }
  const had = new Set(live.transcripts);
  const transcribed = fresh.transcripts.filter((guid) => !had.has(guid));
  if (transcribed.length > 0) {
    return {
      rebuild: true,
      cause: "transcripts",
      reason: `Episodes have gained Transcripts since the live site was built: ${transcribed.join(", ")}`,
    };
  }
  return {
    rebuild: false,
    reason: `The live site already has the newest Episode (${fresh.newestEpisodeGuid}) and every Episode Listen link and Transcript`,
  };
}

export function parseBuildManifest(value: unknown): BuildManifest {
  if (typeof value !== "object" || value === null) {
    throw new Error("Build manifest must be an object");
  }
  if (!("newestEpisodeGuid" in value)) {
    throw new Error("Build manifest is missing newestEpisodeGuid");
  }
  if (!("commit" in value)) {
    throw new Error("Build manifest is missing commit");
  }
  if (!("episodeListenLinks" in value)) {
    throw new Error("Build manifest is missing episodeListenLinks");
  }
  if (!("transcripts" in value)) {
    throw new Error("Build manifest is missing transcripts");
  }
  const { newestEpisodeGuid, commit, episodeListenLinks, transcripts } = value;
  if (!isStringOrNull(newestEpisodeGuid)) {
    throw new Error(
      "Build manifest newestEpisodeGuid must be a string or null"
    );
  }
  if (!isStringOrNull(commit)) {
    throw new Error("Build manifest commit must be a string or null");
  }
  return {
    newestEpisodeGuid,
    commit,
    episodeListenLinks: parseListedEpisodes(episodeListenLinks),
    transcripts: parseGuids(transcripts),
  };
}

function parseGuids(value: unknown): string[] {
  const shape = "Build manifest transcripts must be a list of Episode GUIDs";
  if (!Array.isArray(value)) throw new Error(shape);
  const list: unknown[] = value;
  return list.map((guid) => {
    if (typeof guid !== "string") throw new Error(shape);
    return guid;
  });
}

function parseListedEpisodes(value: unknown): ListedEpisodes {
  const shape =
    "Build manifest episodeListenLinks must map apps to lists of Episode GUIDs";
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(shape);
  }
  const listed: { [A in EpisodeListenApp]?: string[] } = {};
  const entries: [string, unknown][] = Object.entries(value);
  for (const [key, guids] of entries) {
    const app = EPISODE_LISTEN_APPS.find((a) => a === key);
    if (!app) {
      throw new Error(
        `Build manifest episodeListenLinks has "${key}", which isn't an app with Episode Listen links`
      );
    }
    if (!Array.isArray(guids)) throw new Error(shape);
    const list: unknown[] = guids;
    listed[app] = list.map((guid) => {
      if (typeof guid !== "string") throw new Error(shape);
      return guid;
    });
  }
  return listed;
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}
