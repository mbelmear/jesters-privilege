// The build manifest is published at BUILD_MANIFEST_PATH on every deploy. The
// scheduled feed check reads it from the live site and rebuilds only when the
// feed's newest Episode differs from the one recorded here (ADR 0001).

export const BUILD_MANIFEST_PATH = "/build-manifest.json";

export type BuildManifest = {
  // The newest Episode's feed GUID, or null when the feed had no Episodes.
  newestEpisode: string | null;
  // The git commit the deploy was built from, or null for a local build.
  commit: string | null;
};

export function parseBuildManifest(value: unknown): BuildManifest {
  if (typeof value !== "object" || value === null) {
    throw new Error("Build manifest must be an object");
  }
  if (!("newestEpisode" in value)) {
    throw new Error("Build manifest is missing newestEpisode");
  }
  if (!("commit" in value)) {
    throw new Error("Build manifest is missing commit");
  }
  const { newestEpisode, commit } = value;
  if (!isStringOrNull(newestEpisode)) {
    throw new Error("Build manifest newestEpisode must be a string or null");
  }
  if (!isStringOrNull(commit)) {
    throw new Error("Build manifest commit must be a string or null");
  }
  return { newestEpisode, commit };
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}
