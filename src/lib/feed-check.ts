// The scheduled feed check (ADR 0001): every 2 hours, compare the feed's newest
// Episode with the one the live site was built with, and rebuild only when they
// differ or when an Episode has gained an Episode Listen link or a Transcript
// since (ADR 0003).
// Run by scripts/feed-check.ts in .github/workflows/deploy.yml.
import {
  BUILD_MANIFEST_PATH,
  parseBuildManifest,
  type BuildManifest,
} from "./build-manifest";
import { downloadText, errorMessage, type Fetch } from "./download";
import {
  APP_NAMES,
  gainedListenLinks,
  type ListedEpisodes,
} from "./episode-listen-links";

export type FeedCheckIO = {
  // Reads the live site's build manifest.
  fetch: Fetch;
  // The feed's newest Episode's GUID, or null when it has none. Throws when
  // the feed can't be read or breaks a rule.
  newestEpisodeGuid: () => Promise<string | null>;
  // The feed's Episodes each app has a link for now. Never throws: an app
  // whose lookup failed lists none, which never triggers a rebuild.
  episodeListenLinks: () => Promise<ListedEpisodes>;
  // The feed's Episodes that have a Transcript now, by GUID. Never throws: an
  // Episode whose Transcript can't be had isn't listed, which never triggers
  // a rebuild.
  transcripts: () => Promise<string[]>;
};

export type FeedCheck = {
  rebuild: boolean;
  reason: string;
};

export async function checkFeed(
  site: string,
  io: FeedCheckIO
): Promise<FeedCheck> {
  const newestEpisodeGuid = await io.newestEpisodeGuid();
  // Unreadable, it fails the run rather than rebuilding: a manifest that
  // GitHub's runners can never read would otherwise deploy every 2 hours
  // without a word. The Run workflow button rebuilds by hand.
  const manifest = await readLiveManifest(site, io.fetch);
  if (manifest.newestEpisodeGuid !== newestEpisodeGuid) {
    return {
      rebuild: true,
      reason: `The feed's newest Episode (${newestEpisodeGuid}) isn't on the live site, which has ${manifest.newestEpisodeGuid}`,
    };
  }
  const gained = gainedListenLinks(
    manifest.episodeListenLinks,
    await io.episodeListenLinks()
  );
  if (gained.length > 0) {
    const named = gained
      .map(({ app, guid }) => `${guid} in ${APP_NAMES[app]}`)
      .join(", ");
    return {
      rebuild: true,
      reason: `Episodes have gained Episode Listen links since the live site was built: ${named}`,
    };
  }
  const had = new Set(manifest.transcripts);
  const transcribed = (await io.transcripts()).filter((guid) => !had.has(guid));
  if (transcribed.length > 0) {
    return {
      rebuild: true,
      reason: `Episodes have gained Transcripts since the live site was built: ${transcribed.join(", ")}`,
    };
  }
  return {
    rebuild: false,
    reason: `The live site already has the newest Episode (${newestEpisodeGuid}) and every Episode Listen link and Transcript`,
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
// code. A feed or live manifest that can't be read fails the run (1) with no
// output, so the deploy is skipped, the live site stays as it is, and GitHub
// emails whoever last changed the workflow's cron line.
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
