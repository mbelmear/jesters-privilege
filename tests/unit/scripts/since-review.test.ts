/**
 * @jest-environment node
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localGit } from "../../../scripts/pr-gate-git";
import { scriptsDir } from "../../paths";

// Whether a review carries over to a PR's head: the PR gate's sinceReview
// (src/lib/pr-gate/git.ts), run by git in a throwaway repo. These cases held
// the shell script merge ran to the same reading until both were deleted
// (#262).

// Git run from a hook inherits GIT_DIR and GIT_INDEX_FILE, which point every
// git command at the real repository (merge-holds-branch.test.ts tells that
// story), so every git here drops them.
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (name.startsWith("GIT_")) delete env[name];
}

function repo() {
  const dir = mkdtempSync(join(tmpdir(), "since-review-"));
  const git = (...args: string[]) =>
    // Piped, so a merge's chatter on stderr ("Automatic merge went well")
    // stays out of every test run; a failed git still throws with it.
    execFileSync("git", args, {
      cwd: dir,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init", "--quiet", "--initial-branch=main");
  // Refuse to go on anywhere but the throwaway repo.
  if (!git("rev-parse", "--absolute-git-dir").startsWith(realpathSync(dir))) {
    throw new Error(`git isn't working in ${dir}`);
  }
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  git("config", "commit.gpgsign", "false");
  const commit = (file: string, text: string, message: string) => {
    writeFileSync(join(dir, file), text);
    git("add", "-A");
    git("commit", "--quiet", "-m", message);
    return git("rev-parse", "HEAD");
  };
  // The gate's reading, against main as origin/main.
  const gate = localGit(dir, join(scriptsDir, "fetch.sh"), env);
  const carries = (reviewed: string, head: string) => {
    git("update-ref", "refs/remotes/origin/main", "main");
    return gate.sinceReview(reviewed, head) === "clean merges";
  };
  return { dir, git, commit, carries };
}

const lines = "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\n";

describe("sinceReview", () => {
  let r: ReturnType<typeof repo>;
  let reviewed: string;
  beforeEach(() => {
    r = repo();
    r.commit("page.tsx", lines, "base");
    r.git("switch", "--quiet", "-c", "pr");
    reviewed = r.commit("page.tsx", lines.replace("one", "ONE"), "the PR");
  });
  afterEach(() => {
    rmSync(r.dir, { recursive: true, force: true });
  });

  const onMain = (file: string, text: string) => {
    r.git("switch", "--quiet", "main");
    r.commit(file, text, "on main");
    r.git("switch", "--quiet", "pr");
  };

  it("carries a review over a clean merge of main in other files", () => {
    onMain("other.md", "other\n");
    r.git("merge", "--quiet", "--no-edit", "main");
    expect(r.carries(reviewed, r.git("rev-parse", "HEAD"))).toBe(true);
  });

  it("still carries it once main has moved on past the merge", () => {
    onMain("other.md", "other\n");
    r.git("merge", "--quiet", "--no-edit", "main");
    const head = r.git("rev-parse", "HEAD");
    onMain("later.md", "later\n");
    expect(r.carries(reviewed, head)).toBe(true);
  });

  it("refuses a commit of the PR's own after the review", () => {
    onMain("other.md", "other\n");
    r.git("merge", "--quiet", "--no-edit", "main");
    expect(
      r.carries(reviewed, r.commit("other.md", "changed\n", "a fix"))
    ).toBe(false);
  });

  it("refuses a merge that brings main's change to one of the PR's files", () => {
    onMain("page.tsx", lines.replace("nine", "NINE"));
    r.git("merge", "--quiet", "--no-edit", "main");
    expect(r.carries(reviewed, r.git("rev-parse", "HEAD"))).toBe(false);
  });

  it("refuses a merge commit that adds a change of its own", () => {
    onMain("other.md", "other\n");
    r.git("merge", "--quiet", "--no-commit", "main");
    writeFileSync(join(r.dir, "smuggled.md"), "smuggled\n");
    r.git("add", "-A");
    r.git("commit", "--quiet", "--no-edit");
    expect(r.carries(reviewed, r.git("rev-parse", "HEAD"))).toBe(false);
  });

  it("refuses a merge of a branch other than main", () => {
    r.git("switch", "--quiet", "-c", "elsewhere", "main");
    r.commit("elsewhere.md", "elsewhere\n", "not on main");
    r.git("switch", "--quiet", "pr");
    r.git("merge", "--quiet", "--no-edit", "elsewhere");
    expect(r.carries(reviewed, r.git("rev-parse", "HEAD"))).toBe(false);
  });

  it("refuses a head the reviewed commit isn't part of, as after a rebase", () => {
    onMain("other.md", "other\n");
    r.git("rebase", "--quiet", "main");
    expect(r.carries(reviewed, r.git("rev-parse", "HEAD"))).toBe(false);
  });
});
