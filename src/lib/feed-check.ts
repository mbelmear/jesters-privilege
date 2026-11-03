// The scheduled feed check (ADR 0001): every 2 hours, compare the feed's newest
// Episode with the one the live site was built with, and rebuild only when they
// differ. Run by scripts/feed-check.ts in .github/workflows/deploy.yml.
import {
  BUILD_MANIFEST_PATH,
  parseBuildManifest,
  type BuildManifest,
} from "./build-manifest";
import { downloadText, errorMessage, type Fetch } from "./download";

export type FeedCheckIO = {
  // Reads the live site's build manifest.
  fetch: Fetch;
  // The feed's newest Episode's GUID, or null when it has none. Throws when
  // the feed can't be read or breaks a rule.
  newestEpisodeGuid: () => Promise<string | null>;
};

export type FeedCheck = {
  rebuild: boolean;
  newestEpisodeGuid: string | null;
  reason: string;
};

export async function checkFeed(
  site: string,
  io: FeedCheckIO
): Promise<FeedCheck> {
  const newestEpisodeGuid = await io.newestEpisodeGuid();
  let manifest: BuildManifest;
  try {
    manifest = await readLiveManifest(site, io.fetch);
  } catch (error: unknown) {
    return {
      rebuild: true,
      newestEpisodeGuid,
      reason: `The live site's build manifest can't be read (${errorMessage(error)})`,
    };
  }
  if (manifest.newestEpisodeGuid === newestEpisodeGuid) {
    return {
      rebuild: false,
      newestEpisodeGuid,
      reason: `The live site already has the newest Episode (${newestEpisodeGuid})`,
    };
  }
  return {
    rebuild: true,
    newestEpisodeGuid,
    reason: `The feed's newest Episode (${newestEpisodeGuid}) isn't on the live site, which has ${manifest.newestEpisodeGuid}`,
  };
}

async function readLiveManifest(
  site: string,
  fetch: Fetch
): Promise<BuildManifest> {
  const url = site + BUILD_MANIFEST_PATH;
  const text = await downloadText("Build manifest", url, fetch);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`Build manifest ${url} isn't JSON`);
  }
  return parseBuildManifest(value);
}

// What the workflow step sees of a run: GitHub Actions step outputs and
// workflow-command log lines (::notice::, ::error::).
export type FeedCheckEnv = FeedCheckIO & {
  setOutput: (name: string, value: string) => void;
  log: (line: string) => void;
};

// Sets the step output `rebuild` to "true" or "false" and returns the exit
// code. A feed that can't be read fails the run (1) with no output, so the
// deploy is skipped, the live site stays as it is, and GitHub emails the repo
// owner about the failed run.
export async function runFeedCheck(
  site: string,
  env: FeedCheckEnv
): Promise<number> {
  let result: FeedCheck;
  try {
    result = await checkFeed(site, env);
  } catch (error: unknown) {
    env.log(
      `::error::Feed check failed, so the live site stays as it is: ${errorMessage(error)}`
    );
    return 1;
  }
  env.setOutput("rebuild", String(result.rebuild));
  env.log(
    `::notice::${result.rebuild ? "Rebuilding" : "No rebuild"}: ${result.reason}`
  );
  return 0;
}
