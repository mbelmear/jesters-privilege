/**
 * @jest-environment node
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(__dirname, "warn-stale-checkout.sh");

// Git run from a hook inherits GIT_DIR and GIT_INDEX_FILE, which point every
// git command at the real repository (merge-holds-branch.test.ts tells that
// story), so every git here drops them.
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (name.startsWith("GIT_")) delete env[name];
}

describe("warn-stale-checkout", () => {
  let root: string;
  const git = (cwd: string, ...args: string[]) =>
    execFileSync("git", args, { cwd, env, encoding: "utf8" }).trim();
  const warn = (cwd: string) =>
    spawnSync("bash", [script], { cwd, env, encoding: "utf8" });
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

  let origin: string;
  let checkout: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), "stale-checkout-")));
    origin = join(root, "origin");
    checkout = join(root, "checkout");
    execFileSync("git", ["init", "--quiet", "--initial-branch=main", origin], {
      env,
    });
    commit(origin, "first");
    execFileSync("git", ["clone", "--quiet", origin, checkout], { env });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("says nothing when the checkout has all of origin/main", () => {
    const result = warn(checkout);

    expect(result.stdout).toBe("");
    expect(result.status).toBe(0);
  });

  it("counts the commits it is behind, fetching to find them", () => {
    commit(origin, "second");
    commit(origin, "third");

    const result = warn(checkout);

    expect(result.stdout).toContain("2 commits behind origin/main");
    expect(result.stdout).toContain("git show origin/main:AGENTS.md");
    expect(result.status).toBe(0);
  });

  it("says nothing about commits only the checkout has", () => {
    commit(checkout, "local");

    expect(warn(checkout).stdout).toBe("");
  });

  it("says nothing in a ticket's worktree, which falls behind as main moves", () => {
    const worktree = join(root, "worktree");
    git(checkout, "worktree", "add", "--quiet", "-b", "ticket", worktree);
    commit(origin, "second");

    const result = warn(worktree);

    expect(result.stdout).toBe("");
    expect(result.status).toBe(0);
  });

  it("goes by the last fetch, and says so, when origin can't be reached", () => {
    commit(origin, "second");
    git(checkout, "fetch", "--quiet");
    rmSync(origin, { recursive: true, force: true });

    const result = warn(checkout);

    expect(result.stdout).toContain("Couldn't fetch origin");
    expect(result.stdout).toContain("1 commit behind origin/main");
    expect(result.status).toBe(0);
  });
});
