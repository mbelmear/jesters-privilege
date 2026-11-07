/**
 * @jest-environment node
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(__dirname, "no-conflict-markers.sh");

// Git run from a hook inherits GIT_DIR and GIT_INDEX_FILE, which point every
// git command at the real repository (merge-holds-branch.test.ts tells that
// story), so every git here drops them.
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (name.startsWith("GIT_")) delete env[name];
}

describe("the check for leftover conflict markers", () => {
  let repo: string;
  const git = (...args: string[]) =>
    spawnSync(
      "git",
      [
        "-c",
        "user.email=test@example.com",
        "-c",
        "user.name=Test",
        "-c",
        "commit.gpgsign=false",
        ...args,
      ],
      { cwd: repo, env, encoding: "utf8" }
    );
  const write = (text: string) => writeFileSync(join(repo, "notes.md"), text);
  const commit = (text: string, message: string) => {
    write(text);
    git("add", "-A");
    git("commit", "--quiet", "-m", message);
  };
  const check = () =>
    spawnSync(script, [], { cwd: repo, env, encoding: "utf8" });

  beforeEach(() => {
    repo = realpathSync(mkdtempSync(join(tmpdir(), "conflict-markers-")));
    execFileSync("git", ["init", "--quiet", "--initial-branch=main", repo], {
      env,
    });
    commit("start\n", "start");
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it("refuses a conflicted merge staged with its markers, naming the file and line", () => {
    git("checkout", "--quiet", "-b", "other");
    commit("theirs\n", "theirs");
    git("checkout", "--quiet", "main");
    commit("ours\n", "ours");
    git("merge", "--quiet", "other");
    git("add", "-A");

    const result = check();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("notes.md:1");
  });

  it("passes a staged change with no markers", () => {
    write("clean\n");
    git("add", "-A");

    expect(check().status).toBe(0);
  });

  it("leaves other whitespace to Prettier", () => {
    write("two trailing spaces, a Markdown line break  \n");
    git("add", "-A");

    expect(check().status).toBe(0);
  });

  it("fails, rather than passing, when git can't read the staged changes", () => {
    const notRepo = realpathSync(mkdtempSync(join(tmpdir(), "not-a-repo-")));

    const result = spawnSync(script, [], {
      cwd: notRepo,
      env,
      encoding: "utf8",
    });
    rmSync(notRepo, { recursive: true, force: true });

    expect(result.status).not.toBe(0);
  });

  it("ignores markers that aren't staged", () => {
    write("<<<<<<< HEAD\n");

    expect(check().status).toBe(0);
  });
});
