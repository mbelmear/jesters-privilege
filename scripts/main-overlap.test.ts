/**
 * @jest-environment node
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(__dirname, "main-overlap.sh");

// Git run from a hook inherits GIT_DIR and GIT_INDEX_FILE, which point every
// git command at the real repository (merge-holds-branch.test.ts tells that
// story), so every git here drops them.
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (name.startsWith("GIT_")) delete env[name];
}

function repo() {
  const dir = mkdtempSync(join(tmpdir(), "main-overlap-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: dir, env, encoding: "utf8" }).trim();
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
  const overlap = (head: string) =>
    spawnSync("bash", [script, head, "main"], {
      cwd: dir,
      env,
      encoding: "utf8",
    });
  return { git, commit, overlap };
}

describe("main-overlap", () => {
  it("lists a commit main gained since the branch point in a file the PR changes", () => {
    const r = repo();
    r.commit("deploy.md", "start\n", "start");
    r.git("checkout", "--quiet", "-b", "ticket");
    const head = r.commit("deploy.md", "the PR's line\n", "the PR");
    r.git("checkout", "--quiet", "main");
    const other = r.commit("deploy.md", "main's line\n", "Smoke check");

    const result = r.overlap(head);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${other} Smoke check\n`);
  });

  it("leaves out a commit that touches only other files", () => {
    const r = repo();
    r.commit("deploy.md", "start\n", "start");
    r.git("checkout", "--quiet", "-b", "ticket");
    const head = r.commit("deploy.md", "the PR's line\n", "the PR");
    r.git("checkout", "--quiet", "main");
    r.commit("other.md", "main's line\n", "Elsewhere");

    expect(r.overlap(head).stdout).toBe("");
  });

  it("leaves out a commit the branch has already merged in", () => {
    const r = repo();
    r.commit("deploy.md", "start\n", "start");
    r.git("checkout", "--quiet", "-b", "ticket");
    r.commit("deploy.md", "the PR's line\n", "the PR");
    r.git("checkout", "--quiet", "main");
    r.commit("other.md", "main's line\n", "Elsewhere");
    r.commit("deploy.md", "main's line\n", "Smoke check");
    r.git("checkout", "--quiet", "ticket");
    r.git("merge", "--quiet", "--strategy-option=ours", "--no-edit", "main");
    const head = r.git("rev-parse", "HEAD");

    expect(r.overlap(head).stdout).toBe("");
  });

  it("finds a file whose name git would otherwise quote", () => {
    const r = repo();
    r.commit("café.md", "start\n", "start");
    r.git("checkout", "--quiet", "-b", "ticket");
    const head = r.commit("café.md", "the PR's line\n", "the PR");
    r.git("checkout", "--quiet", "main");
    const other = r.commit("café.md", "main's line\n", "Accented");

    expect(r.overlap(head).stdout).toBe(`${other} Accented\n`);
  });
});
