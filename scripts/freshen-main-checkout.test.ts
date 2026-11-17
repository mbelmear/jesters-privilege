/**
 * @jest-environment node
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(__dirname, "freshen-main-checkout.sh");

// Git run from a hook inherits GIT_DIR and GIT_INDEX_FILE, which point every
// git command at the real repository (merge-holds-branch.test.ts tells that
// story), so every git here drops them.
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (name.startsWith("GIT_")) delete env[name];
}

describe("freshen-main-checkout", () => {
  let root: string;
  const git = (cwd: string, ...args: string[]) =>
    execFileSync("git", args, { cwd, env, encoding: "utf8" }).trim();
  const freshen = (cwd: string) =>
    spawnSync("bash", [script], { cwd, env, encoding: "utf8" });
  const commit = (cwd: string, message: string, file = "file") => {
    writeFileSync(join(cwd, file), `${message}\n`);
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
    root = realpathSync(mkdtempSync(join(tmpdir(), "freshen-main-")));
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
    const result = freshen(checkout);

    expect(result.stdout).toBe("");
    expect(result.status).toBe(0);
  });

  // #224's retro: a session started 22 commits behind and missed a rule only
  // origin/main's AGENTS.md had, though this hook had warned.
  it("fast-forwards a clean main to origin/main, fetching to find it", () => {
    commit(origin, "second");
    commit(origin, "third");

    const result = freshen(checkout);

    expect(result.stdout).toContain(
      "Fast-forwarded the main checkout 2 commits to origin/main."
    );
    expect(result.stdout).not.toContain("AGENTS.md");
    expect(git(checkout, "rev-parse", "HEAD")).toBe(
      git(origin, "rev-parse", "HEAD")
    );
    expect(result.status).toBe(0);
  });

  it("says to reread AGENTS.md when the fast-forward changed it", () => {
    commit(origin, "a new rule", "AGENTS.md");

    const result = freshen(checkout);

    expect(result.stdout).toContain("1 commit to origin/main");
    expect(result.stdout).toContain("AGENTS.md changed");
  });

  it("only warns when the checkout has uncommitted changes", () => {
    commit(origin, "second");
    writeFileSync(join(checkout, "file"), "the human's edit\n");

    const result = freshen(checkout);

    expect(result.stdout).toContain("1 commit behind origin/main");
    expect(result.stdout).toContain("git show origin/main:AGENTS.md");
    expect(git(checkout, "show", "HEAD:file")).toBe("first");
    expect(result.status).toBe(0);
  });

  it("only warns when the checkout is on another branch", () => {
    commit(origin, "second");
    git(checkout, "switch", "--quiet", "-c", "other");

    const result = freshen(checkout);

    expect(result.stdout).toContain("1 commit behind origin/main");
    expect(git(checkout, "log", "-1", "--format=%s")).toBe("first");
  });

  it("only warns when main has commits origin/main doesn't", () => {
    commit(origin, "second");
    commit(checkout, "local");

    const result = freshen(checkout);

    expect(result.stdout).toContain("1 commit behind origin/main");
    expect(git(checkout, "log", "-1", "--format=%s")).toBe("local");
    expect(result.status).toBe(0);
  });

  it("says nothing about commits only the checkout has", () => {
    commit(checkout, "local");

    expect(freshen(checkout).stdout).toBe("");
  });

  it("says nothing in a ticket's worktree, which falls behind as main moves", () => {
    const worktree = join(root, "worktree");
    git(checkout, "worktree", "add", "--quiet", "-b", "ticket", worktree);
    commit(origin, "second");

    const result = freshen(worktree);

    expect(result.stdout).toBe("");
    expect(result.status).toBe(0);
  });

  it("goes by the last fetch, and says so, when origin can't be reached", () => {
    commit(origin, "second");
    git(checkout, "fetch", "--quiet");
    rmSync(origin, { recursive: true, force: true });

    const result = freshen(checkout);

    expect(result.stdout).toContain("Couldn't fetch origin");
    expect(result.stdout).toContain("1 commit to origin/main");
    expect(result.status).toBe(0);
  });
});
