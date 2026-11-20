// Wait for a pull request's current head to finish CI and get its preview,
// then report: every check, the preview URL built from that head, and whether
// the PR merges cleanly with main. Exits 1 if a check fails, it conflicts, or
// it can't tell. Read-only. The logic is src/lib/pr-gate/pr-status.ts.
// mark-ready.sh reads the "Preview: https://" line; keep its shape.
// Usage: npm run pr-status -- <pr-number>
import { join } from "node:path";
import { prStatus } from "@/lib/pr-gate/pr-status";
import { realClock } from "@/lib/pr-gate/waits";
import { localGit } from "./pr-gate-git";
import { ghGitHub } from "./pr-gate-github";

const args = process.argv.slice(2);
if (args.length !== 1 || !/^[0-9]+$/.test(args[0] ?? "")) {
  console.error("Usage: npm run pr-status -- <pr-number>");
  process.exit(2);
}

prStatus(Number(args[0]), {
  github: ghGitHub,
  git: localGit(process.cwd(), join(__dirname, "fetch.sh")),
  clock: realClock,
  out: (line) => console.log(line),
  err: (line) => console.error(line),
}).then(
  (code) => process.exit(code),
  (error: unknown) => {
    // gh has printed its own error; this adds which command it was.
    const message = error instanceof Error ? error.message : String(error);
    console.error(message.split("\n")[0]);
    process.exit(1);
  }
);
