// The build manifest is published at BUILD_MANIFEST_PATH on every deploy. The
// scheduled feed check reads it from the live site and rebuilds when the
// feed's newest Episode differs from the one recorded here (ADR 0001), or when
// an Episode has gained an Episode Listen link since (ADR 0003).
import {
  EPISODE_LISTEN_APPS,
  type EpisodeListenApp,
  type ListedEpisodes,
} from "./episode-listen-links";

export const BUILD_MANIFEST_PATH = "/build-manifest.json";

export type BuildManifest = {
  // The newest Episode's feed GUID, or null when the feed had no Episodes.
  newestEpisodeGuid: string | null;
  // The git commit the deploy was built from, or null for a local build.
  commit: string | null;
  // The Episodes the deploy had Episode Listen links for, by app.
  episodeListenLinks: ListedEpisodes;
};

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
  const { newestEpisodeGuid, commit, episodeListenLinks } = value;
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
  };
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
