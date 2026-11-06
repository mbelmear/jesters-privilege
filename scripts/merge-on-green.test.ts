/**
 * @jest-environment node
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const script = join(__dirname, "merge-on-green.sh");

// Git run from a hook inherits GIT_DIR and GIT_INDEX_FILE, which point every
// git command at the real repository (merge-holds-branch.test.ts tells that
// story), so every git here drops them.
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (name.startsWith("GIT_")) delete env[name];
}

// A clone of a throwaway origin, and a stand-in for gh on the PATH: GitHub
// reports the PR's head as reviewed and its checks as passed, and a merge
// prints a line rather than happening.
function repo() {
  const root = mkdtempSync(join(tmpdir(), "merge-on-green-"));
  const origin = join(root, "origin.git");
  const dir = join(root, "clone");
  const bin = join(root, "bin");
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
  const commit = (text: string, message: string) => {
    writeFileSync(join(dir, "deploy.md"), text);
    git("add", "-A");
    git("commit", "--quiet", "-m", message);
    return git("rev-parse", "HEAD");
  };
  const fakeGh = (head: string) => {
    mkdirSync(bin, { recursive: true });
    writeFileSync(
      join(bin, "gh"),
      `#!/bin/sh
case "$*" in
  *headRefOid*) echo ${head} ;;
  *statusCheckRollup*) echo 3 ;;
  *comments*) echo "Code review: passed at ${head}" ;;
  "pr checks"*) ;;
  "pr merge"*) echo MERGED ;;
esac
`
    );
    chmodSync(join(bin, "gh"), 0o755);
  };
  const merge = (...args: string[]) =>
    spawnSync("bash", [script, "7", ...args], {
      cwd: dir,
      env: { ...env, PATH: `${bin}${delimiter}${env.PATH}` },
      encoding: "utf8",
    });
  return { root, git, commit, fakeGh, merge };
}

describe("merge-on-green", () => {
  let r: ReturnType<typeof repo>;
  beforeEach(() => {
    r = repo();
    r.commit("start\n", "start");
    r.git("push", "--quiet", "origin", "main");
    r.git("checkout", "--quiet", "-b", "ticket");
    const head = r.commit("the PR's line\n", "the PR");
    r.git("push", "--quiet", "origin", "ticket");
    r.fakeGh(head);
    r.git("checkout", "--quiet", "main");
  });
  afterEach(() => {
    rmSync(r.root, { recursive: true, force: true });
  });

  // What main gains while the PR's checks run.
  function mainGains(message: string) {
    const sha = r.commit(`${message}\n`, message);
    r.git("push", "--quiet", "origin", "main");
    return sha;
  }

  it("merges when main has gained nothing in the PR's files", () => {
    const result = r.merge();

    expect(result.stdout).toContain("MERGED");
    expect(result.status).toBe(0);
  });

  it("refuses, naming the commit, when main has gained one in the PR's files", () => {
    const other = mainGains("Smoke check");

    const result = r.merge();

    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("MERGED");
    expect(result.stderr).toContain(`${other} Smoke check`);
    expect(result.stderr).toContain(`--overlap-read ${other}`);
  });

  it("merges once the newest such commit is passed as read", () => {
    const other = mainGains("Smoke check");

    const result = r.merge("--overlap-read", other);

    expect(result.stdout).toContain("MERGED");
    expect(result.status).toBe(0);
  });

  it("refuses when a newer commit has landed since the one read", () => {
    const read = mainGains("Smoke check");
    const newer = mainGains("Another");

    const result = r.merge("--overlap-read", read);

    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("MERGED");
    expect(result.stderr).toContain(`--overlap-read ${newer}`);
  });
});
