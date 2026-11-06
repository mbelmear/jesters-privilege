/**
 * @jest-environment node
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const script = join(__dirname, "docs-only.sh");

// Git run from a hook inherits GIT_DIR and GIT_INDEX_FILE, which point every
// git command at the real repository (merge-holds-branch.test.ts tells that
// story), so every git here drops them.
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (name.startsWith("GIT_")) delete env[name];
}

function repo() {
  const dir = mkdtempSync(join(tmpdir(), "docs-only-"));
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
  const write = (file: string) => {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), `${file} at ${Math.random()}\n`);
  };
  const commit = (...files: string[]) => {
    files.forEach(write);
    git("add", "-A");
    git("commit", "--quiet", "--allow-empty", "-m", "change");
    return git("rev-parse", "HEAD");
  };
  const docsOnly = (base: string, head: string) =>
    spawnSync("bash", [script, base, head], {
      cwd: dir,
      env,
      encoding: "utf8",
    });
  return { dir, git, commit, docsOnly };
}

describe("docs-only", () => {
  let r: ReturnType<typeof repo>;
  let base: string;
  beforeEach(() => {
    r = repo();
    base = r.commit("start.txt");
  });
  afterEach(() => {
    rmSync(r.dir, { recursive: true, force: true });
  });

  it("says true for a change under docs/ and to top-level Markdown", () => {
    const head = r.commit("docs/agents/notes.md", "docs/plan.txt", "AGENTS.md");

    const result = r.docsOnly(base, head);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("true\n");
  });

  it.each([
    ["anything else", ["src/app/page.tsx"]],
    ["a change that also touches docs", ["docs/plan.md", "src/app/page.tsx"]],
    ["Markdown below the top level", ["src/content/notes.md"]],
    ["a workflow", [".github/workflows/ci.yml"]],
    ["a folder whose name starts with docs", ["docs-site/index.html"]],
    ["a top-level file that isn't Markdown", ["package.json"]],
  ])("says false for %s", (_, files) => {
    const head = r.commit(...files);

    const result = r.docsOnly(base, head);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("false\n");
  });

  it("says false for a file moved from elsewhere into docs/", () => {
    const code = r.commit("src/lib/feed.ts");
    mkdirSync(join(r.dir, "docs"));
    renameSync(join(r.dir, "src/lib/feed.ts"), join(r.dir, "docs/feed.ts"));
    const head = r.commit();

    const result = r.docsOnly(code, head);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("false\n");
  });

  it("says false when nothing differs, so a surprise runs every job", () => {
    const result = r.docsOnly(base, base);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("false\n");
  });

  it("fails, printing no answer, when git can't read a commit", () => {
    const result = r.docsOnly(base, "no-such-commit");

    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe("");
  });
});
