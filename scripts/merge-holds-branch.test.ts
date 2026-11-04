/**
 * @jest-environment node
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(__dirname, "merge-holds-branch.sh");

// Git run from a hook inherits GIT_DIR and GIT_INDEX_FILE, which point every
// git command at the real repository whatever its cwd: under the pre-commit
// hook this test once committed to main, moved a ticket branch, and set
// core.bare in the shared .git/config (2026-11-04). So every git it runs
// drops them.
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (name.startsWith("GIT_")) delete env[name];
}

// A throwaway repo where a ticket branch is squash-merged into main, as
// GitHub merges every pull request.
function repo() {
  const dir = mkdtempSync(join(tmpdir(), "merge-holds-branch-"));
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
  const write = (lines: string[]) =>
    writeFileSync(join(dir, "feed.xml"), lines.join("\n") + "\n");
  const commit = (message: string) => {
    git("add", "-A");
    git("commit", "--quiet", "-m", message);
    return git("rev-parse", "HEAD");
  };
  const holds = (head: string, merge: string) =>
    spawnSync("bash", [script, head, merge], {
      cwd: dir,
      env,
      encoding: "utf8",
    });
  return { dir, git, write, commit, holds };
}

// Ten lines, so changes at the top and bottom are separate hunks.
const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`);

describe("merge-holds-branch", () => {
  let r: ReturnType<typeof repo>;
  beforeEach(() => {
    r = repo();
    r.write(lines);
    r.commit("start");
  });
  afterEach(() => rmSync(r.dir, { recursive: true, force: true }));

  // The branch edits the bottom of a file; another PR merges first and edits
  // its top (#134 after #135, 2026-11-04).
  it("passes a squash merge after main changed the same file elsewhere", () => {
    r.git("checkout", "--quiet", "-b", "ticket");
    r.write([...lines.slice(0, 9), "line 10, approved"]);
    const head = r.commit("ticket");
    r.git("checkout", "--quiet", "main");
    r.write(["line 1, from another PR", ...lines.slice(1)]);
    r.commit("another PR");
    r.git("merge", "--quiet", "--squash", "ticket");
    const merge = r.commit("ticket, squashed");

    expect(r.holds(head, merge).status).toBe(0);
  });

  it("refuses a merge commit that lacks part of the branch's work", () => {
    r.git("checkout", "--quiet", "-b", "ticket");
    r.write(["line 1, mine", ...lines.slice(1, 9), "line 10, mine"]);
    const head = r.commit("ticket");
    r.git("checkout", "--quiet", "main");
    r.write(["line 1, mine", ...lines.slice(1)]);
    const merge = r.commit("only half of the ticket");

    const result = r.holds(head, merge);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/feed\.xml/);
  });

  // Indentation is work too: in YAML or a Python file it changes meaning.
  it("refuses a merge commit that lost the branch's whitespace", () => {
    r.git("checkout", "--quiet", "-b", "ticket");
    r.write([...lines, "  indented"]);
    const head = r.commit("ticket");
    r.git("checkout", "--quiet", "main");
    r.write([...lines, "indented"]);
    const merge = r.commit("ticket, flattened");

    expect(r.holds(head, merge).status).toBe(1);
  });
});
