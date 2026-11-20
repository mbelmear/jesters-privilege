// The PR gate's view of the local checkout: which commit it has checked out,
// and whether a PR's head merges cleanly with main.
import { execFileSync, spawnSync } from "node:child_process";

export type MergesCleanly = "yes" | "no" | "unknown";

export interface Git {
  /** The branch checked out, or undefined outside any branch. */
  branch(): string | undefined;
  /** The commit checked out. */
  head(): string;
  /**
   * Whether `head` merges with main without a conflict, by `git merge-tree`
   * against a freshly fetched origin/main. "unknown" when the fetch failed or
   * left either commit missing: never "yes" without having checked.
   */
  mergesCleanly(head: string): MergesCleanly;
}

/** Git in `dir`, fetching through scripts/fetch.sh, which waits out another session's fetch. */
export function localGit(
  dir: string,
  fetchScript: string,
  env: NodeJS.ProcessEnv = process.env
): Git {
  const run = (file: string, args: string[]) =>
    spawnSync(file, args, { cwd: dir, env, encoding: "utf8" });
  const has = (commit: string) =>
    run("git", ["cat-file", "-e", `${commit}^{commit}`]).status === 0;

  return {
    branch() {
      const result = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
      const branch = result.stdout.trim();
      return result.status === 0 && branch !== "HEAD" ? branch : undefined;
    },
    head() {
      return execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: dir,
        env,
        encoding: "utf8",
      }).trim();
    },
    mergesCleanly(head) {
      const fetched = run(fetchScript, ["--quiet", "origin", "main", head]);
      if (fetched.status !== 0 || !has(head) || !has("origin/main")) {
        return "unknown";
      }
      const merged = run("git", [
        "merge-tree",
        "--write-tree",
        "--quiet",
        "origin/main",
        head,
      ]).status;
      if (merged === 0) return "yes";
      return merged === 1 ? "no" : "unknown";
    },
  };
}
