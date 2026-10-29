// Fails when draft content would go live: run before launch (#30), and before
// any deploy once the Jesters' words are all in. Usage: npm run launch-check
import { content } from "@/content";
import { feedSource } from "@/content/feed";
import { findDrafts } from "@/lib/content";

const drafts = findDrafts({ ...content, feed: feedSource });

if (drafts.length > 0) {
  console.error(
    [
      `Launch check failed: ${drafts.length} pieces of draft content would go live.`,
      ...drafts.map((path) => `  - ${path}`),
      "",
      "Replace each with the Jesters' words and remove its `draft: true` (src/content/).",
      "`feed` is the fixture: set feedSource in src/content/feed.ts to the Spreaker feed URL.",
    ].join("\n")
  );
  process.exit(1);
}
console.log("Launch check passed: no draft content.");
