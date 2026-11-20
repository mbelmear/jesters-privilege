/**
 * @jest-environment node
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localGit } from "../../../scripts/pr-gate-git";
import { scriptsDir } from "../../paths";

// The rest of localGit runs in tests/unit/lib/pr-gate/pr-status.test.ts,
// against a throwaway origin.
describe("localGit", () => {
  it("says which command failed where, outside a checkout", () => {
    const dir = mkdtempSync(join(tmpdir(), "pr-gate-git-"));
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      GIT_CEILING_DIRECTORIES: tmpdir(),
    };
    for (const name of Object.keys(env)) {
      if (name.startsWith("GIT_") && name !== "GIT_CEILING_DIRECTORIES") {
        delete env[name];
      }
    }
    try {
      const git = localGit(dir, join(scriptsDir, "fetch.sh"), env);

      expect(git.branch()).toBeUndefined();
      expect(() => git.head()).toThrow(
        new RegExp(
          `^git rev-parse HEAD failed in ${dir}: .*not a git repository`
        )
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
