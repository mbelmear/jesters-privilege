// The PR gate's FirstScreen (src/lib/pr-gate/first-screen-cost.ts), asking
// scripts/first-screen-files.sh, the one list of first-screen files.
import { execFileSync } from "node:child_process";
import type { FirstScreen } from "@/lib/pr-gate/first-screen-cost";

export const firstScreenFiles =
  (script: string): FirstScreen =>
  (paths) =>
    execFileSync(script, { input: paths.join("\n"), encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
