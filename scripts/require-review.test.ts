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

const script = join(__dirname, "require-review.sh");

// Git run from a hook inherits GIT_DIR and GIT_INDEX_FILE, which point every
// git command at the real repository (merge-holds-branch.test.ts tells that
// story), so every git here drops them.
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (name.startsWith("GIT_")) delete env[name];
}

// A clone of a throwaway origin, and a stand-in for gh on the PATH that shows
// one passed review and logs any comment posted.
function repo() {
  const root = mkdtempSync(join(tmpdir(), "require-review-"));
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
  const fakeGh = (reviewed: string) => {
    mkdirSync(bin, { recursive: true });
    writeFileSync(
      join(bin, "gh"),
      `#!/bin/sh
case "$*" in
  *comments*) echo "Code review: passed at ${reviewed}" ;;
  "pr comment"*) echo "$*" >> "${posted}" ;;
esac
`
    );
    chmodSync(join(bin, "gh"), 0o755);
  };
  const requireReview = (head: string) =>
    spawnSync("bash", [script, "7", head, "merge"], {
      cwd: dir,
      env: { ...env, PATH: `${bin}${delimiter}${env.PATH}` },
      encoding: "utf8",
    });
  const postedComment = () =>
    existsSync(posted) ? readFileSync(posted, "utf8") : "";
  return { root, git, commit, fakeGh, requireReview, postedComment };
}

describe("require-review", () => {
  let r: ReturnType<typeof repo>;
  let reviewed: string;
  beforeEach(() => {
    r = repo();
    r.commit("page.tsx", "start\n", "start");
    r.git("push", "--quiet", "origin", "main");
    r.git("switch", "--quiet", "-c", "ticket");
    reviewed = r.commit("page.tsx", "the PR's line\n", "the PR");
    r.fakeGh(reviewed);
  });
  afterEach(() => {
    rmSync(r.root, { recursive: true, force: true });
  });

  // What main gains while the PR waits, merged into the PR.
  function mergeMainGaining(file: string, text: string) {
    r.git("switch", "--quiet", "main");
    r.commit(file, text, "on main");
    r.git("push", "--quiet", "origin", "main");
    r.git("switch", "--quiet", "ticket");
    r.git("merge", "--quiet", "--no-edit", "-X", "ours", "origin/main");
    return r.git("rev-parse", "HEAD");
  }

  it("passes the head the review names, recording nothing", () => {
    expect(r.requireReview(reviewed).status).toBe(0);
    expect(r.postedComment()).toBe("");
  });

  it("carries the review over a clean merge of main, and records it", () => {
    const head = mergeMainGaining("other.md", "other\n");

    const result = r.requireReview(head);

    expect(result.status).toBe(0);
    // The post-merge audit reads this comment as a review of the final head.
    expect(r.postedComment()).toMatch(
      new RegExp(`--body Code review: passed at ${head} `)
    );
    expect(r.postedComment()).toContain(`carried over from ${reviewed}`);
  });

  it("refuses a merge that touches the PR's files, naming the fixed point", () => {
    const head = mergeMainGaining("page.tsx", "main's line\n");

    const result = r.requireReview(head);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`with ${reviewed} as the fixed point`);
    expect(r.postedComment()).toBe("");
  });

  it("refuses a commit of the PR's own after the review", () => {
    const head = r.commit("page.tsx", "a fix\n", "a fix");

    expect(r.requireReview(head).status).toBe(1);
    expect(r.postedComment()).toBe("");
  });
});
