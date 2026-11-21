// Set the `PR gate` commit status on a pull request's head: success once its
// head has a passed review (or only clean merges of main since one), it closes
// only the issues it names, and a first-screen change carries its cost;
// failure, saying why, otherwise. The `Protect main` ruleset requires it, so
// GitHub's merge button waits for it. The PR gate workflow
// (.github/workflows/pr-gate.yml) runs it from main's code; the logic is
// src/lib/pr-gate/check.ts. Exits 1 only when a read failed.
// Usage: PR_GATE_TARGET_URL=<url> tsx scripts/pr-gate-check.ts <pr-number>
import { join } from "node:path";
import { prGateCheck } from "@/lib/pr-gate/check";
import { realClock } from "@/lib/pr-gate/waits";
import { firstScreenFiles } from "./pr-gate-first-screen";
import { localGit } from "./pr-gate-git";
import { ghGitHub } from "./pr-gate-github";

const args = process.argv.slice(2);
const targetUrl = process.env.PR_GATE_TARGET_URL ?? "";
if (
  args.length !== 1 ||
  !/^[0-9]+$/.test(args[0] ?? "") ||
  !targetUrl.startsWith("https://")
) {
  console.error(
    "Usage: PR_GATE_TARGET_URL=<url> tsx scripts/pr-gate-check.ts <pr-number>"
  );
  process.exit(2);
}

const err = (line: string) => console.error(line);
try {
  process.exit(
    prGateCheck(Number(args[0]), {
      github: ghGitHub,
      // git's own errors on stderr, in the run's log.
      git: localGit(
        process.cwd(),
        join(__dirname, "fetch.sh"),
        process.env,
        err
      ),
      clock: realClock,
      firstScreen: firstScreenFiles(join(__dirname, "first-screen-files.sh")),
      targetUrl,
      out: (line) => console.log(line),
      err,
    })
  );
} catch (error) {
  // Reading the PR's head, or setting the status, failed: gh said why, and
  // the run goes red, as no status says it.
  const message = error instanceof Error ? error.message : String(error);
  err(message.split("\n")[0] ?? "");
  process.exit(1);
}
