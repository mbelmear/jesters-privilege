// The scheduled feed check (#18): decides whether the Deploy workflow rebuilds,
// by comparing the feed's newest Episode with the live site's build manifest.
// The logic is src/lib/feed-check.ts; this wires in the network and the
// workflow. Usage (in .github/workflows/deploy.yml): npx tsx scripts/feed-check.ts
import { appendFileSync } from "node:fs";
import { getEpisodes } from "@/content/feed";
import { site } from "@/content/site";
import { runFeedCheck } from "@/lib/feed-check";

const outputFile = process.env.GITHUB_OUTPUT;

runFeedCheck(site.url, {
  fetch: (url) => fetch(url, { signal: AbortSignal.timeout(30_000) }),
  newestEpisodeGuid: async () => (await getEpisodes())[0]?.guid ?? null,
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
