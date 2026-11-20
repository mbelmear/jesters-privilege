// The PR gate's Git (src/lib/pr-gate/git.ts), run in a checkout.
import { spawnSync } from "node:child_process";
import type { Git } from "@/lib/pr-gate/git";

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
      const result = run("git", ["rev-parse", "HEAD"]);
      if (result.status !== 0) throw new Error(result.stderr.trim());
      return result.stdout.trim();
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
