/**
 * @jest-environment node
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const script = join(__dirname, "worktree-done.sh");

// Git run from a hook inherits GIT_DIR and GIT_INDEX_FILE, which point every
// git command at the real repository (merge-holds-branch.test.ts tells that
// story), so every git here drops them, and reads no machine-wide config.
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (name.startsWith("GIT_")) delete env[name];
}
env.GIT_CONFIG_GLOBAL = "/dev/null";
env.GIT_CONFIG_NOSYSTEM = "1";
const realGit = execFileSync("sh", ["-c", "command -v git"], {
  encoding: "utf8",
}).trim();

// A bare origin, a main checkout, and ticket 7's worktree beside it on branch
// `ticket`, pushed and squash-merged into main as GitHub merges PR 70. On the
// PATH, a gh that answers for PR 70, and a git that, while a `survive` file
// exists, leaves the worktree's folder behind after `worktree remove`, with
// the message git gave when that happened to #175's.
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "worktree-done-")));
  const bin = join(root, "bin");
  const main = join(root, "checkout");
  const folder = join(root, "jp-7");
  const survive = join(root, "survive");
  const git = (cwd: string, ...args: string[]) =>
    execFileSync(
      realGit,
      [
        "-c",
        "user.email=test@example.com",
        "-c",
        "user.name=Test",
        "-c",
        "commit.gpgsign=false",
        ...args,
      ],
      { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    ).trim();

  execFileSync(realGit, ["init", "--quiet", "--bare", join(root, "origin")], {
    env,
  });
  execFileSync(realGit, ["clone", "--quiet", join(root, "origin"), main], {
    env,
    stdio: "ignore",
  });
  git(main, "commit", "--quiet", "--allow-empty", "-m", "start");
  git(main, "push", "--quiet", "origin", "HEAD:main");
  git(main, "worktree", "add", "--quiet", folder, "-b", "ticket");
  writeFileSync(join(folder, "feed.xml"), "<rss/>\n");
  git(folder, "add", "-A");
  git(folder, "commit", "--quiet", "-m", "ticket");
  git(folder, "push", "--quiet", "origin", "ticket");
  git(main, "merge", "--quiet", "--squash", "ticket");
  git(main, "commit", "--quiet", "-m", "ticket (#70)");
  git(main, "push", "--quiet", "origin", "HEAD:main");
  const merge = git(main, "rev-parse", "HEAD");

  mkdirSync(bin);
  writeFileSync(join(bin, "gh"), `#!/bin/sh\necho "MERGED ticket ${merge}"\n`, {
    mode: 0o755,
  });
  writeFileSync(
    join(bin, "git"),
    `#!/bin/sh
"${realGit}" "$@"
status=$?
if [ "$1 $2" = "worktree remove" ] && [ -e "${survive}" ]; then
  mkdir -p "$3/node_modules"
  echo "error: failed to delete '$3': Directory not empty" >&2
  exit 255
fi
exit $status
`,
    { mode: 0o755 }
  );

  const run = () =>
    spawnSync("bash", [script, "70"], {
      cwd: main,
      env: { ...env, PATH: `${bin}${delimiter}${env.PATH}` },
      encoding: "utf8",
    });
  const branches = () => ({
    local: git(main, "branch", "--list", "ticket"),
    remote: git(main, "ls-remote", "--heads", "origin", "ticket"),
  });
  return { root, folder, survive, run, branches };
}

describe("worktree-done.sh", () => {
  let f: ReturnType<typeof fixture>;

  beforeEach(() => {
    f = fixture();
  });

  afterEach(() => {
    rmSync(f.root, { recursive: true, force: true });
  });

  it("removes the worktree and deletes its branch here and on GitHub", () => {
    const result = f.run();

    expect(result.stdout).toContain("#70 is done.");
    expect(result.status).toBe(0);
    expect(existsSync(f.folder)).toBe(false);
    expect(f.branches()).toEqual({ local: "", remote: "" });
  });

  it("fails, naming the folder, and keeps the branch, when the folder survives", () => {
    writeFileSync(f.survive, "");

    const result = f.run();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Refusing: ${f.folder} is still there`);
    expect(result.stdout).not.toContain("is done");
    expect(f.branches().local).not.toBe("");
  });

  it("still fails on a rerun, once git no longer lists the worktree", () => {
    writeFileSync(f.survive, "");
    f.run();
    rmSync(f.survive);

    const result = f.run();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Refusing: ${f.folder} is still there`);
    expect(f.branches().local).not.toBe("");
  });

  it("finishes on the rerun after the folder is deleted", () => {
    writeFileSync(f.survive, "");
    f.run();
    rmSync(f.survive);
    rmSync(f.folder, { recursive: true, force: true });

    const result = f.run();

    expect(result.stdout).toContain("#70 is done.");
    expect(result.status).toBe(0);
    expect(f.branches()).toEqual({ local: "", remote: "" });
  });
});
