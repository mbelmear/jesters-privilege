/**
 * @jest-environment node
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repoRoot, scriptsDir } from "../../paths";

const script = join(scriptsDir, "fetch.sh");

// Whether a file runs git fetch itself, on a line that isn't a comment.
function rawFetches(text: string): boolean {
  return text
    .split("\n")
    .filter((line) => !/^\s*(#|\/\/)/.test(line))
    .some((line) => /\bgit fetch\b|\bgit\(\s*"fetch"/.test(line));
}

// Git run from a hook inherits GIT_DIR and GIT_INDEX_FILE, which point every
// git command at the real repository (merge-holds-branch.test.ts tells that
// story), so every git here drops them.
const env: NodeJS.ProcessEnv = { ...process.env, FETCH_RETRY_DELAY: "0.2" };
for (const name of Object.keys(env)) {
  if (name.startsWith("GIT_")) delete env[name];
}

describe("fetch", () => {
  let root: string;
  let origin: string;
  let checkout: string;
  const git = (cwd: string, ...args: string[]) =>
    execFileSync("git", args, { cwd, env, encoding: "utf8" }).trim();
  const commit = (cwd: string, message: string) => {
    writeFileSync(join(cwd, "file"), `${message}\n`);
    git(cwd, "add", "-A");
    git(
      cwd,
      "-c",
      "user.email=test@example.com",
      "-c",
      "user.name=Test",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "-m",
      message
    );
  };
  // Another session's fetch, caught mid-update of origin/main.
  const lockOriginMain = () => {
    const lock = join(checkout, ".git/refs/remotes/origin/main.lock");
    writeFileSync(lock, "");
    return lock;
  };
  const fetchAsync = (...args: string[]) =>
    new Promise<{ status: number | null; stderr: string }>((resolve) => {
      const child = spawn("bash", [script, ...args], { cwd: checkout, env });
      let stderr = "";
      child.stderr.on("data", (chunk) => (stderr += chunk));
      child.on("close", (status) => resolve({ status, stderr }));
    });

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), "fetch-")));
    origin = join(root, "origin");
    checkout = join(root, "checkout");
    execFileSync("git", ["init", "--quiet", "--initial-branch=main", origin], {
      env,
    });
    commit(origin, "first");
    execFileSync("git", ["clone", "--quiet", origin, checkout], { env });
    commit(origin, "second");
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("fetches, passing its arguments to git fetch", () => {
    const result = spawnSync("bash", [script, "--quiet", "origin", "main"], {
      cwd: checkout,
      env,
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(git(checkout, "rev-parse", "origin/main")).toBe(
      git(origin, "rev-parse", "main")
    );
  });

  // #256's worktree-done failed on "cannot lock ref" while another session
  // fetched; a rerun moments later went through.
  it("waits out another fetch holding a ref's lock", async () => {
    const lock = lockOriginMain();
    const fetching = fetchAsync("--quiet", "origin");
    setTimeout(() => unlinkSync(lock), 300);
    const result = await fetching;
    expect(result.status).toBe(0);
    expect(git(checkout, "rev-parse", "origin/main")).toBe(
      git(origin, "rev-parse", "main")
    );
  });

  it("fails with git's own message once the lock outlasts its retries", async () => {
    lockOriginMain();
    const result = await fetchAsync("--quiet", "origin");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("cannot lock ref");
  });

  it("passes on what git says when the fetch succeeds", () => {
    const result = spawnSync("bash", [script, "origin"], {
      cwd: checkout,
      env,
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("origin/main");
  });

  describe("every fetch of ours", () => {
    // Where this repo runs git fetch itself: its scripts, its git hooks, and
    // its npm scripts. Workflows run alone on a runner, with no session to
    // race.
    const ours = [
      ...readdirSync(scriptsDir)
        .filter((name) => name !== "fetch.sh")
        .map((name) => join(scriptsDir, name)),
      ...readdirSync(join(repoRoot, ".husky"))
        .filter((name) => !name.startsWith("_"))
        .map((name) => join(repoRoot, ".husky", name)),
      join(repoRoot, "package.json"),
    ];

    it("finds a raw fetch in a shell line or a git() call, not in a comment", () => {
      expect(rawFetches("if ! git fetch --quiet origin main; then")).toBe(true);
      expect(rawFetches('  git("fetch", "--quiet", "origin", "main");')).toBe(
        true
      );
      expect(rawFetches("# git fetch fails on a lock\n// git fetch")).toBe(
        false
      );
    });

    it("goes through fetch.sh", () => {
      const raw = ours.filter((path) => rawFetches(readFileSync(path, "utf8")));
      expect(raw).toEqual([]);
    });
  });

  it("fails at once on any other error", () => {
    const started = Date.now();
    const result = spawnSync("bash", [script, "nowhere"], {
      cwd: checkout,
      env: { ...env, FETCH_RETRY_DELAY: "5" },
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(Date.now() - started).toBeLessThan(4000);
  });
});
