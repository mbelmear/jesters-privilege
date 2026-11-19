/**
 * @jest-environment node
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { scriptsDir } from "../../paths";

const script = join(scriptsDir, "first-screen-reminder.sh");

// Git run from a hook inherits GIT_DIR and GIT_INDEX_FILE, which point every
// git command at the real repository, so every git here drops them.
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (name.startsWith("GIT_")) delete env[name];
}

describe("the pre-commit reminder to measure the first screen", () => {
  let repo: string;
  const stage = (...paths: string[]) => {
    for (const path of paths) {
      mkdirSync(dirname(join(repo, path)), { recursive: true });
      writeFileSync(join(repo, path), "changed\n");
    }
    execFileSync("git", ["add", "-A"], { cwd: repo, env });
  };
  const remind = () =>
    spawnSync(script, [], { cwd: repo, env, encoding: "utf8" });

  beforeEach(() => {
    repo = realpathSync(mkdtempSync(join(tmpdir(), "first-screen-reminder-")));
    execFileSync("git", ["init", "--quiet", repo], { env });
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it("says nothing when the commit touches no first-screen file", () => {
    stage("src/lib/episode-feed.ts", "docs/testing.md");
    const result = remind();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("names each first-screen file staged and says to measure before review, without stopping the commit", () => {
    stage(
      "src/app/layout.tsx",
      "src/components/site-footer.tsx",
      "src/lib/feed.ts"
    );
    const result = remind();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe(
      "This commit changes src/app/layout.tsx, src/components/site-footer.tsx, on the first screen.\n" +
        "Run `npm run lighthouse:compare` before review and put its figures in the PR body (docs/testing.md, Merging).\n"
    );
  });
});
