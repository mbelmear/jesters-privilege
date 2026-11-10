/**
 * @jest-environment node
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const script = join(__dirname, "review-passed.sh");

// Git run from a hook inherits GIT_DIR and GIT_INDEX_FILE, which point every
// git command at the real repository (merge-holds-branch.test.ts tells that
// story), so every git here drops them.
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (name.startsWith("GIT_")) delete env[name];
}

// A clone of a throwaway origin, on the PR's branch `ticket`, and a stand-in
// for gh on the PATH: GitHub shows the branch's pushed head as the PR's, and
// any comment posted is logged.
function repo() {
  const root = mkdtempSync(join(tmpdir(), "review-passed-"));
  const origin = join(root, "origin.git");
  const dir = join(root, "clone");
  const bin = join(root, "bin");
  const posted = join(root, "posted.log");
  execFileSync(
    "git",
    ["init", "--quiet", "--bare", "--initial-branch=main", origin],
    { env }
  );
  execFileSync("git", ["clone", "--quiet", origin, dir], {
    env,
    stdio: "ignore",
  });
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: dir, env, encoding: "utf8" }).trim();
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
  mkdirSync(bin, { recursive: true });
  writeFileSync(
    join(bin, "gh"),
    `#!/bin/sh
case "$*" in
  *headRefName*) echo ticket ;;
  *headRefOid*) git rev-parse origin/ticket ;;
  "pr comment"*) echo "$*" >> "${posted}" ;;
esac
`
  );
  chmodSync(join(bin, "gh"), 0o755);
  const reviewPassed = (sha: string) =>
    spawnSync("bash", [script, "7", sha], {
      cwd: dir,
      env: { ...env, PATH: `${bin}${delimiter}${env.PATH}` },
      encoding: "utf8",
    });
  const postedComment = () =>
    existsSync(posted) ? readFileSync(posted, "utf8") : "";
  return { root, git, commit, reviewPassed, postedComment };
}

describe("review-passed", () => {
  let r: ReturnType<typeof repo>;
  let reviewed: string;
  beforeEach(() => {
    r = repo();
    r.commit("page.tsx", "start\n", "start");
    r.git("push", "--quiet", "origin", "main");
    r.git("switch", "--quiet", "-c", "ticket");
    reviewed = r.commit("page.tsx", "the PR's line\n", "the PR");
    r.git("push", "--quiet", "-u", "origin", "ticket");
  });
  afterEach(() => {
    rmSync(r.root, { recursive: true, force: true });
  });

  // What main gains, merged into the PR before it's pushed, as the pre-push
  // hook asks whenever main has moved.
  function mergeMainGaining(file: string, text: string) {
    r.git("switch", "--quiet", "main");
    r.commit(file, text, "on main");
    r.git("push", "--quiet", "origin", "main");
    r.git("switch", "--quiet", "ticket");
    r.git("merge", "--quiet", "--no-edit", "-X", "ours", "origin/main");
    r.git("push", "--quiet", "origin", "ticket");
    return r.git("rev-parse", "HEAD");
  }

  it("records a review of the PR's head", () => {
    const result = r.reviewPassed(reviewed);

    expect(result.status).toBe(0);
    expect(r.postedComment()).toBe(
      `pr comment 7 --body Code review: passed at ${reviewed}\n`
    );
  });

  it("records a review of a commit followed only by clean merges of main, at the head", () => {
    const head = mergeMainGaining("other.md", "other\n");

    const result = r.reviewPassed(reviewed);

    expect(result.status).toBe(0);
    // merge and the post-merge audit read the head's SHA from this line.
    expect(r.postedComment()).toBe(
      `pr comment 7 --body Code review: passed at ${head} (reviewed ${reviewed}: only clean merges of main since)\n`
    );
  });

  it("refuses a merge of main that touches the PR's files, naming the review it needs", () => {
    mergeMainGaining("page.tsx", "main's line\n");

    const result = r.reviewPassed(reviewed);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `with ${reviewed} as the fixed point (docs/testing.md, Merging: a merge of main that changes the PR's files)`
    );
    expect(r.postedComment()).toBe("");
  });

  it("refuses a commit of the PR's own after the review", () => {
    r.commit("page.tsx", "a fix\n", "a fix");
    r.git("push", "--quiet", "origin", "ticket");

    const result = r.reviewPassed(reviewed);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Review the new commits first");
    expect(r.postedComment()).toBe("");
  });
});
