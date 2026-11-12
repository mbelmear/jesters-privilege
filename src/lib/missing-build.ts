import { existsSync } from "node:fs";
import { join } from "node:path";

export const MISSING_BUILD =
  "out/ has no build: run `npm run build` first (`npm run build:empty-feed` for FEED=empty)";

// Browser tests and screenshots serve the built site in out/. Without one,
// Playwright waited out its 60 s webServer timeout and named the server, not
// the build (#209's retro), so both stop here first.
export function refuseMissingBuild(root: string): void {
  if (!existsSync(join(root, "out", "index.html")))
    throw new Error(MISSING_BUILD);
}
