// A throwaway origin with main, and a clone on a PR's branch `ticket`, one
// commit ahead and pushed, for the PR gate's tests. GitHub (FakeGitHub) shows
// that commit as the PR's head, open, with every check passed and its preview
// skipped, unless a test says otherwise. Importing it removes each one after
// every test.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FakeGitHub } from "@/lib/pr-gate/fake-github";
import { fakeClock } from "@/lib/pr-gate/waits";
import { localGit } from "../../../../scripts/pr-gate-git";
import { scriptsDir } from "../../../paths";

// Git run from a hook inherits GIT_DIR and GIT_INDEX_FILE, which point every
// git command at the real repository (merge-holds-branch.test.ts), so every
// git here drops them.
export const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (name.startsWith("GIT_")) delete env[name];
}

export const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

/** The comment `npm run review-passed` posts. */
export const passedAt = (sha: string) => `Code review: passed at ${sha}`;

/** The deploy workflow's comment, naming the commit its preview is built from. */
export const previewOf = (sha: string) =>
  `<!-- deploy-preview -->\n**Preview:** https://pr-7.example.workers.dev\n\nBuilt from ${sha}.`;

export function throwawayPr(prefix: string) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  roots.push(root);
  const origin = join(root, "origin.git");
  const dir = join(root, "clone");
  git(root, "init", "--quiet", "--bare", "--initial-branch=main", origin);
  git(root, "clone", "--quiet", origin, dir);
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "user.name", "Test");
  git(dir, "config", "commit.gpgsign", "false");
  /** Commits `text` to `file` on the branch checked out, returning its SHA. */
  const commit = (file: string, text: string, message: string) => {
    writeFileSync(join(dir, file), text);
    git(dir, "add", "-A");
    git(dir, "commit", "--quiet", "-m", message);
    return git(dir, "rev-parse", "HEAD");
  };
  commit("deploy.md", "top\nmiddle\nbottom\n", "Main");
  git(dir, "push", "--quiet", "origin", "main");
  git(dir, "switch", "--quiet", "-c", "ticket");
  const head = commit("ticket.md", "the ticket\n", "Ticket");
  git(dir, "push", "--quiet", "origin", "ticket");

  const github = new FakeGitHub({ state: "OPEN", branch: "ticket", head });
  github.checkList = [
    { name: "Lint workflows", state: "pass", link: "" },
    { name: "Preview URL", state: "skipping", link: "" },
  ];
  const clock = fakeClock();
  const out: string[] = [];
  const err: string[] = [];
  const gate = {
    github,
    git: localGit(dir, join(scriptsDir, "fetch.sh"), env),
    clock,
    out: (line: string) => out.push(line),
    err: (line: string) => err.push(line),
  };
  return { dir, head, github, clock, out, err, gate, commit };
}

/** Commits to main on origin, then returns to `ticket`. */
export function mainGains(
  t: ReturnType<typeof throwawayPr>,
  file: string,
  text: string
) {
  git(t.dir, "switch", "--quiet", "main");
  t.commit(file, text, "On main");
  git(t.dir, "push", "--quiet", "origin", "main");
  git(t.dir, "switch", "--quiet", "ticket");
}
