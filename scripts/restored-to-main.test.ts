/**
 * @jest-environment node
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(__dirname, "restored-to-main.sh");

// Git run from a hook inherits GIT_DIR and GIT_INDEX_FILE, which point every
// git command at the real repository (merge-holds-branch.test.ts tells that
// story), so every git here drops them.
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (name.startsWith("GIT_")) delete env[name];
}

function repo() {
  const dir = mkdtempSync(join(tmpdir(), "restored-to-main-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: dir,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init", "--quiet", "--initial-branch=main");
  // Refuse to go on anywhere but the throwaway repo.
  if (!git("rev-parse", "--absolute-git-dir").startsWith(realpathSync(dir))) {
    throw new Error(`git isn't working in ${dir}`);
  }
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  git("config", "commit.gpgsign", "false");
  const commit = (files: Record<string, string>, message: string) => {
    for (const [file, text] of Object.entries(files)) {
      writeFileSync(join(dir, file), text);
    }
    git("add", "-A");
    git("commit", "--quiet", "-m", message);
    return git("rev-parse", "HEAD");
  };
  const restored = (reviewed: string, head: string) =>
    execFileSync("bash", [script, reviewed, head, "main"], {
      cwd: dir,
      env,
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);
  return { dir, git, commit, restored };
}

describe("restored-to-main", () => {
  let r: ReturnType<typeof repo>;
  let reviewed: string;
  beforeEach(() => {
    r = repo();
    r.commit({ "report.ts": "report\n", "workflow.yml": "workflow\n" }, "base");
    r.git("switch", "--quiet", "-c", "pr");
    reviewed = r.commit(
      {
        "report.ts": "report, changed\n",
        "workflow.yml": "workflow, changed\n",
      },
      "the PR"
    );
  });
  afterEach(() => {
    rmSync(r.dir, { recursive: true, force: true });
  });

  it("lists a file the fix round put back as main has it", () => {
    const head = r.commit({ "report.ts": "report\n" }, "the fix");
    expect(r.restored(reviewed, head)).toEqual(["report.ts"]);
  });

  it("leaves out a file the fix round changed again but didn't put back", () => {
    const head = r.commit(
      { "workflow.yml": "workflow, changed twice\n" },
      "the fix"
    );
    expect(r.restored(reviewed, head)).toEqual([]);
  });

  it("leaves out a file the PR first changed after the review", () => {
    const head = r.commit({ "fix.md": "new\n" }, "the fix");
    expect(r.restored(reviewed, head)).toEqual([]);
  });

  it("lists a file the PR added and the fix round removed", () => {
    r.git("reset", "--quiet", "--hard", "main");
    reviewed = r.commit({ "added.ts": "added\n" }, "the PR");
    r.git("rm", "--quiet", "added.ts");
    r.git("commit", "--quiet", "-m", "the fix");
    expect(r.restored(reviewed, r.git("rev-parse", "HEAD"))).toEqual([
      "added.ts",
    ]);
  });

  it("matches the file against main as merged in, not main before it", () => {
    r.git("switch", "--quiet", "main");
    r.commit({ "report.ts": "report, as main changed it\n" }, "on main");
    r.git("switch", "--quiet", "pr");
    r.git("merge", "--quiet", "--no-edit", "-X", "theirs", "main");
    const head = r.git("rev-parse", "HEAD");
    expect(r.restored(reviewed, head)).toEqual(["report.ts"]);
  });
});
