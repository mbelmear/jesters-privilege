/**
 * @jest-environment node
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const script = join(__dirname, "new-worktree.sh");

// Git run from a hook inherits GIT_DIR and GIT_INDEX_FILE, which point every
// git command at the real repository, so every git here drops them.
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (name.startsWith("GIT_")) delete env[name];
}

// A main checkout of a throwaway origin, with npm and npx stubbed on the PATH
// so nothing installs.
function repo() {
  // Resolved: git lists worktrees by real path, and macOS's tmpdir is a symlink.
  const root = realpathSync(mkdtempSync(join(tmpdir(), "new-worktree-")));
  const origin = join(root, "origin.git");
  const main = join(root, "main");
  const bin = join(root, "bin");
  execFileSync(
    "git",
    ["init", "--quiet", "--bare", "--initial-branch=main", origin],
    { env }
  );
  execFileSync("git", ["clone", "--quiet", origin, main], {
    env,
    stdio: "ignore",
  });
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: main, env, encoding: "utf8" }).trim();
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  git("config", "commit.gpgsign", "false");
  const commitAgents = (text: string) => {
    writeFileSync(join(main, "AGENTS.md"), text);
    git("add", "-A");
    git("commit", "--quiet", "-m", text);
    git("push", "--quiet", "origin", "main");
  };
  mkdirSync(bin);
  for (const tool of ["npm", "npx"]) {
    writeFileSync(join(bin, tool), "#!/bin/sh\n");
    chmodSync(join(bin, tool), 0o755);
  }
  const start = () =>
    spawnSync("bash", [script, "48", "ticket"], {
      cwd: main,
      env: { ...env, PATH: `${bin}${delimiter}${env.PATH}` },
      encoding: "utf8",
    });
  return { root, git, commitAgents, start };
}

describe("new-worktree", () => {
  let r: ReturnType<typeof repo>;
  beforeEach(() => {
    r = repo();
    r.commitAgents("the rules\n");
  });
  afterEach(() => {
    rmSync(r.root, { recursive: true, force: true });
  });

  it("makes the worktree beside the main checkout, and says so", () => {
    const result = r.start();

    expect(result.status).toBe(0);
    expect(existsSync(join(r.root, "jp-48", "AGENTS.md"))).toBe(true);
    expect(result.stdout).toContain(`Ready: ${join(r.root, "jp-48")}`);
    expect(result.stdout).not.toContain("read ");
  });

  it("points at the worktree's AGENTS.md when the main checkout's is behind it", () => {
    r.commitAgents("the newer rules\n");
    r.git("reset", "--quiet", "--hard", "HEAD~1");

    const result = r.start();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      `read ${join(r.root, "jp-48", "AGENTS.md")}`
    );
  });
});
