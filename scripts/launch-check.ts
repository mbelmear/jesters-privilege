// Fails when draft content would go live: run before launch (#30), and before
// any deploy once the Jesters' words are all in. Usage: npm run launch-check
import { content } from "@/content";
import { feedSource } from "@/content/feed";
import { execFileSync } from "node:child_process";
import { behindWarning } from "@/lib/checkout-freshness";
import { findDrafts } from "@/lib/content";

// An old checkout lists drafts that have since changed, and none added since.
try {
  const git = (...args: string[]) =>
    execFileSync("git", args, { encoding: "utf8" }).trim();
  git("fetch", "--quiet", "origin", "main");
  const warning = behindWarning(
    Number(git("rev-list", "--count", "HEAD..origin/main"))
  );
  if (warning) console.warn(warning);
} catch (error: unknown) {
  console.warn(`Can't tell whether this checkout is current: ${String(error)}`);
}

const drafts = findDrafts({ ...content, feed: feedSource });

if (drafts.length > 0) {
  console.error(
    [
      `Launch check failed: ${drafts.length} pieces of draft content would go live.`,
      ...drafts.map((path) => `  - ${path}`),
      "",
      "Replace each with the Jesters' words and remove its `draft: true` (src/content/).",
    ].join("\n")
  );
  process.exit(1);
}
console.log("Launch check passed: no draft content.");
