// Mark a visual pull request ready for a Jester's review by adding the
// `ready-for-human` label, once its head is reviewed, every check passes, its
// preview is built from that head, and it merges cleanly with main. Exits 1,
// saying why, on any refusal. The logic is src/lib/pr-gate/mark-ready.ts.
// Usage: npm run mark-ready -- <pr-number>
import { join } from "node:path";
import { markReady } from "@/lib/pr-gate/mark-ready";
import { realClock } from "@/lib/pr-gate/waits";
import { firstScreenFiles } from "./pr-gate-first-screen";
import { localGit } from "./pr-gate-git";
import { ghGitHub } from "./pr-gate-github";

const args = process.argv.slice(2);
if (args.length !== 1 || !/^[0-9]+$/.test(args[0] ?? "")) {
  console.error("Usage: npm run mark-ready -- <pr-number>");
  process.exit(2);
}

markReady(Number(args[0]), {
  github: ghGitHub,
  git: localGit(process.cwd(), join(__dirname, "fetch.sh")),
  clock: realClock,
  firstScreen: firstScreenFiles(join(__dirname, "first-screen-files.sh")),
  out: (line) => console.log(line),
  err: (line) => console.error(line),
}).then(
  (code) => process.exit(code),
  (error: unknown) => {
    // gh printed its own error, and this adds which command it was; a quiet
    // read (pr-gate-github.ts) puts gh's error on this first line instead.
    const message = error instanceof Error ? error.message : String(error);
    console.error(message.split("\n")[0]);
    process.exit(1);
  }
);
