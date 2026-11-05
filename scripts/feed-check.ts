// The scheduled feed check (#18): decides whether the Deploy workflow rebuilds,
// by comparing the feed's newest Episode, its Episodes' Listen links, and
// which of them have Transcripts with the live site's build manifest.
// The logic is src/lib/feed-check.ts; this wires in the network and the
// workflow. Usage: npm run feed-check (run by .github/workflows/deploy.yml)
import { appendFileSync } from "node:fs";
import { getEpisodes, lookUpEpisodes, lookUpTranscripts } from "@/content/feed";
import { site } from "@/content/site";
import {
  APP_NAMES,
  EPISODE_LISTEN_APPS,
  listedEpisodes,
} from "@/lib/episode-listen-links";
import { runFeedCheck } from "@/lib/feed-check";

const outputFile = process.env.GITHUB_OUTPUT;

// A workflow annotation, shown on the run's summary page.
const warn = (message: string) => console.log(`::warning::${message}`);

runFeedCheck(site.url, {
  fetch: (url) => fetch(url, { signal: AbortSignal.timeout(30_000) }),
  newestEpisodeGuid: async () => (await getEpisodes())[0]?.guid ?? null,
  episodeListenLinks: async () => {
    // A failed lookup lists no Episodes, so it never rebuilds; say so.
    const lookups = await lookUpEpisodes({ spotifyKeyRequired: true });
    for (const app of EPISODE_LISTEN_APPS) {
      const lookup = lookups[app];
      if (lookup?.kind === "failed") {
        warn(
          `${APP_NAMES[app]} lookup failed, so its Episode Listen links aren't checked: ${lookup.reason}`
        );
      }
    }
    return listedEpisodes(await getEpisodes(), lookups);
  },
  // Read as the build reads them. An Episode left without one never rebuilds,
  // so the run's annotations name it and why (a new Episode, until Transcribe
  // reaches it, too).
  transcripts: async () => [...(await lookUpTranscripts(warn)).keys()],
  setOutput: (name, value) => {
    const line = `${name}=${value}\n`;
    if (outputFile) appendFileSync(outputFile, line);
    else process.stdout.write(line);
  },
  log: (line) => console.log(line),
}).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  }
);
