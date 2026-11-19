// Asks the feed's source once per build, before `next build`, for everything
// the build reads: the Episodes, every Episode's Transcript (the host's where
// the feed links one, the site's own from the `transcripts` branch
// otherwise, ADR 0003) and each podcast app's lookup of them. It writes the
// answer to one snapshot, which every page and the build manifest read
// (src/lib/episode-feed.ts). A feed that can't be read fails here, so the
// last good deploy stays live (ADR 0001); an Episode left without its
// Transcript or Listen link is named in the log and never fails the build.
// Usage: npm run snapshot (run by build and dev)
import { feed, FEED_SNAPSHOT, feedSnapshot } from "@/content/feed";

feed
  .lookUp({ spotifyKeyRequired: process.env.SITE_ENV === "production" })
  .then(async (snapshot) => {
    await feedSnapshot.write(snapshot);
    console.log(
      `Wrote ${FEED_SNAPSHOT}: the feed, ${snapshot.transcripts.size} Episodes' Transcripts and the apps' lookups`
    );
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
