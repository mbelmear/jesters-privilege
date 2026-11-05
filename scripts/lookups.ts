// Looks the Feed's Episodes up in each podcast app once per build, before
// `next build`, so every page and the build manifest read the same answer
// (src/content/feed.ts, getLookups). A failed lookup is written as failed and
// never fails the build. A build from the fixture reads its own file and needs
// none. Usage: npm run lookups (run by build and dev)
import { writeFileSync } from "node:fs";
import { feedSource, LOOKUPS_SNAPSHOT, lookUpEpisodes } from "@/content/feed";
import { serializeLookups } from "@/lib/episode-listen-links";

if (feedSource.kind === "url") {
  lookUpEpisodes({
    spotifyKeyRequired: process.env.SITE_ENV === "production",
  }).then(
    (lookups) => {
      writeFileSync(
        LOOKUPS_SNAPSHOT,
        JSON.stringify(serializeLookups(lookups))
      );
      console.log(`Wrote the apps' Episode lookups to ${LOOKUPS_SNAPSHOT}`);
    },
    (error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    }
  );
}
