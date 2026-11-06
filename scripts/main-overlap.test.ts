/**
 * @jest-environment node
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
  return { dir, git, commit, overlap };
}

describe("main-overlap", () => {
  let r: ReturnType<typeof repo>;
  beforeEach(() => {
    r = repo();
  });
  afterEach(() => {
    rmSync(r.dir, { recursive: true, force: true });
  });

  it("lists a commit main gained since the branch point in a file the PR changes", () => {
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
    r.commit("deploy.md", "start\n", "start");
    r.git("checkout", "--quiet", "-b", "ticket");
    const head = r.commit("deploy.md", "the PR's line\n", "the PR");
    r.git("checkout", "--quiet", "main");
    r.commit("other.md", "main's line\n", "Elsewhere");

    expect(r.overlap(head).stdout).toBe("");
  });

  it("leaves out a commit the branch has already merged in", () => {
    r.commit("deploy.md", "start\n", "start");
    r.git("checkout", "--quiet", "-b", "ticket");
    r.commit("deploy.md", "the PR's line\n", "the PR");
    r.git("checkout", "--quiet", "main");
    r.commit("deploy.md", "main's line\n", "Smoke check");
    r.git("checkout", "--quiet", "ticket");
    r.git("merge", "--quiet", "--strategy-option=ours", "--no-edit", "main");
    const head = r.git("rev-parse", "HEAD");

    expect(r.overlap(head).stdout).toBe("");
  });

  it("finds a file whose name git would otherwise quote", () => {
    r.commit("café.md", "start\n", "start");
    r.git("checkout", "--quiet", "-b", "ticket");
    const head = r.commit("café.md", "the PR's line\n", "the PR");
    r.git("checkout", "--quiet", "main");
    const other = r.commit("café.md", "main's line\n", "Accented");

    expect(r.overlap(head).stdout).toBe(`${other} Accented\n`);
  });

  it("lists a commit to the old name of a file the PR renames", () => {
    r.commit("deploy.md", "a\nb\nc\nd\ne\n", "start");
    r.git("checkout", "--quiet", "-b", "ticket");
    renameSync(join(r.dir, "deploy.md"), join(r.dir, "ops.md"));
    r.git("add", "-A");
    r.git("commit", "--quiet", "-m", "the PR");
    const head = r.git("rev-parse", "HEAD");
    r.git("checkout", "--quiet", "main");
    const other = r.commit("deploy.md", "a\nb\nc\nd\nmain's\n", "Smoke check");

    expect(r.overlap(head).stdout).toBe(`${other} Smoke check\n`);
  });

  it("--patch shows those commits' changes to the PR's files alone", () => {
    r.commit("shared", "start\n", "Start");
    r.git("checkout", "--quiet", "-b", "pr");
    const head = r.commit("shared", "start\npr's\n", "PR");
    r.git("checkout", "--quiet", "main");
    writeFileSync(join(r.dir, "elsewhere"), "main's other file\n");
    r.commit("shared", "main's line\nstart\n", "Smoke check");

    const result = spawnSync("bash", [script, "--patch", head, "main"], {
      cwd: r.dir,
      env,
      encoding: "utf8",
    });

    expect(result.stdout).toContain("Smoke check");
    expect(result.stdout).toContain("+main's line");
    expect(result.stdout).not.toContain("main's other file");
    expect(result.status).toBe(0);
  });
});
