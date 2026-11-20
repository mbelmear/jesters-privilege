// A PR that changes the header, the footer, or the root layout carries
// `npm run lighthouse:compare` output in its body: CODING_STANDARDS.md,
// Performance, "A change to the first screen shows its cost". #233 changed
// the header and footer and reached review without the run (#51). Review
// still judges the rest of that rule: what these files render (the mobile
// menu, the player dock) and what a page fetches before its paint.
import type { PrContents } from "./github";
import { refusing, type Action } from "./snapshot";

/**
 * Which of these paths are first-screen files. Production asks
 * scripts/first-screen-files.sh, the one list of them, which the pre-commit
 * reminder reads too.
 */
export type FirstScreen = (paths: readonly string[]) => string[];

export function requireFirstScreenCost(
  pr: number,
  { body, files }: PrContents,
  firstScreen: FirstScreen,
  action: Action
) {
  if (body.includes("lighthouse:compare")) return;
  const changed = firstScreen(files);
  if (!changed.length) return;
  throw refusing(
    action,
    pr,
    `it changes ${changed.join(", ")}, and its body has no \`npm run lighthouse:compare\` output.`,
    "Run it against main (docs/testing.md, Performance), add its figures to the body, then rerun."
  );
}
