/**
 * @jest-environment node
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Git run from a hook inherits GIT_DIR and GIT_INDEX_FILE, which point every
// git command at the real repository (merge-holds-branch.test.ts tells that
// story), so every git here drops them.
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (name.startsWith("GIT_")) delete env[name];
}

describe("npm run worktree", () => {
  let root: string;
  const git = (cwd: string, ...args: string[]) =>
    execFileSync("git", args, { cwd, env, encoding: "utf8" }).trim();
  const commitScript = (cwd: string, says: string) => {
    writeFileSync(
      join(cwd, "scripts", "new-worktree.sh"),
      `#!/usr/bin/env bash\necho "${says}: $1 $2"\n`
    );
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
      says
    );
  };

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), "new-worktree-")));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("runs origin/main's script from a checkout that is behind", () => {
    const origin = join(root, "origin");
    const checkout = join(root, "checkout");
    execFileSync("git", ["init", "--quiet", "--initial-branch=main", origin], {
      env,
    });
    mkdirSync(join(origin, "scripts"));
    copyFileSync(
      join(__dirname, "..", "package.json"),
      join(origin, "package.json")
    );
    commitScript(origin, "stale");
    execFileSync("git", ["clone", "--quiet", origin, checkout], { env });
    commitScript(origin, "current");

    const result = spawnSync(
      "npm",
      ["run", "--silent", "worktree", "--", "104", "a-branch"],
      { cwd: checkout, env, encoding: "utf8" }
    );

    expect(result.stdout).toContain("current: 104 a-branch");
    expect(result.status).toBe(0);
  });
});
