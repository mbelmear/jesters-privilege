// The scheduled feed check (#18): decides whether the Deploy workflow rebuilds,
// by comparing the record a fresh build would make (the feed's newest Episode,
// its Episodes' Listen links, and which of them have Transcripts) with the
// live site's build manifest. The logic is src/lib/feed-check.ts; this wires
// in the network and the workflow.
// Usage: npm run feed-check (run by .github/workflows/deploy.yml)
import { appendFileSync } from "node:fs";
import { feed } from "@/content/feed";
import { site } from "@/content/site";
import { buildRecord } from "@/lib/build-manifest";
import { runFeedCheck } from "@/lib/feed-check";

const outputFile = process.env.GITHUB_OUTPUT;

// A workflow annotation, shown on the run's summary page.
const warn = (message: string) => console.log(`::warning::${message}`);

runFeedCheck(site.url, {
  fetch: (url) => fetch(url, { signal: AbortSignal.timeout(30_000) }),
  // Everything a fresh build would read, asked once. The run's annotations
  // name each Episode left without a Transcript (a new Episode, until
  // Transcribe reaches it, too) and each app whose lookup failed: neither
  // ever rebuilds.
  freshRecord: async () => buildRecord(await feed.lookUp({ warn })),
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
