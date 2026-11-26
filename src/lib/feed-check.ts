// The feed check (ADR 0001): every hour (ADR 0004), compare the record a
// fresh build would make with the one the live site was built with, and
// rebuild only when the feed's newest Episode differs or an Episode has gained
// an Episode Listen link or a Transcript since (ADR 0003). The comparison is
// `compareRecords` (src/lib/build-manifest.ts); this is the run around it.
// Run by scripts/feed-check.ts in .github/workflows/deploy.yml.
import {
  BUILD_MANIFEST_PATH,
  compareRecords,
  parseBuildManifest,
  type BuildManifest,
  type BuildRecord,
  type FeedCheck,
} from "./build-manifest";
import { downloadText, errorMessage, type Fetch } from "./download";

// What the workflow step sees of a run: GitHub Actions step outputs and
// workflow-command log lines (::notice::, ::error::).
export type FeedCheckEnv = {
  // Reads the live site's build manifest.
  fetch: Fetch;
  // The record a build would make now. Throws when the feed can't be read or
  // breaks a rule; a Transcript or lookup that fails never does, it only
  // leaves that Episode unlisted, which never triggers a rebuild.
  freshRecord: () => Promise<BuildRecord>;
  setOutput: (name: string, value: string) => void;
  log: (line: string) => void;
};

// Sets the step outputs `rebuild` and `new-episode` (the feed's newest
// Episode is one the live site lacks) to "true" or "false" and returns the
// exit code. A feed or live manifest that can't be read fails the run (1) with no
// output, so the deploy is skipped, the live site stays as it is, and the
// Deploy report opens "Feed check is failing" (docs/deploy.md, Triggers, says
// whom GitHub emails).
export async function runFeedCheck(
  site: string,
  env: FeedCheckEnv
): Promise<number> {
  let result: FeedCheck;
  try {
    const fresh = await env.freshRecord();
    // Unreadable, it fails the run rather than rebuilding: a manifest that
    // GitHub's runners can never read would otherwise deploy every hour
    // without a word. The Run workflow button rebuilds by hand.
    const live = await readLiveManifest(site, env.fetch);
    result = compareRecords(live, fresh);
  } catch (error: unknown) {
    env.log(
      `::error::Feed check failed, so the live site stays as it is: ${errorMessage(error)}`
    );
    return 1;
  }
  env.setOutput("rebuild", String(result.rebuild));
  env.setOutput("new-episode", String(result.rebuild && result.newEpisode));
  env.log(
    `::notice::${result.rebuild ? "Rebuilding" : "No rebuild"}: ${result.reason}`
  );
  return 0;
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
