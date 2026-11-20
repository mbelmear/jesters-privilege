// Record that /code-review passed on a pull request's head commit, as the
// "Code review: passed at <sha>" comment that `npm run merge` and
// `npm run mark-ready` require. The logic is src/lib/pr-gate/review-passed.ts.
// Usage: npm run review-passed -- <pr-number> <reviewed full SHA>
import { join } from "node:path";
import { reviewPassed } from "@/lib/pr-gate/review-passed";
import { realClock } from "@/lib/pr-gate/waits";
import { localGit } from "./pr-gate-git";
import { ghExit, ghGitHub } from "./pr-gate-github";

/** gh has said its own error; anything else says its first line. */
function failed(error: unknown) {
  if (ghExit(error) !== undefined) return;
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.split("\n")[0]);
}

const err = (line: string) => console.error(line);

reviewPassed(process.argv.slice(2), {
  github: ghGitHub,
  // git's own errors on stderr, as review-passed.sh let git print them.
  git: localGit(process.cwd(), join(__dirname, "fetch.sh"), process.env, err),
  clock: realClock,
  err,
  failed,
}).then(
  (code) => process.exit(code),
  (error: unknown) => {
    // Posting the comment failed: gh's own exit code, as the shell script's.
    failed(error);
    process.exit(ghExit(error) ?? 1);
  }
);
