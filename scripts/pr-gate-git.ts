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
  const fetch = (head: string) =>
    run(fetchScript, ["--quiet", "origin", "main", head]).status === 0;
  const isAncestor = (ancestor: string, commit: string) =>
    run("git", ["merge-base", "--is-ancestor", ancestor, commit]).status === 0;
  /** What `commit` changes since it left main, blob by blob; undefined if git failed. */
  const changes = (commit: string, main: string) => {
    const base = run("git", ["merge-base", commit, main]);
    if (base.status !== 0) return undefined;
    const diff = run("git", [
      "diff",
      "--raw",
      "--no-renames",
      "--abbrev=40",
      base.stdout.trim(),
      commit,
    ]);
    return diff.status === 0 ? diff.stdout : undefined;
  };

  return {
    branch() {
      const result = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
      const branch = result.stdout.trim();
      return result.status === 0 && branch !== "HEAD" ? branch : undefined;
    },
    head() {
      const result = run("git", ["rev-parse", "HEAD"]);
      if (result.status !== 0) {
        throw new Error(
          `git rev-parse HEAD failed in ${dir}: ${result.error?.message ?? result.stderr.trim()}`
        );
      }
      return result.stdout.trim();
    },
    fetch,
    isAncestor,
    mergedMainOnly(reviewed, head) {
      const main = "origin/main";
      if (!isAncestor(reviewed, head)) return false;
      const own = run("git", [
        "rev-list",
        "--no-merges",
        `${reviewed}..${head}`,
        "--not",
        main,
      ]);
      if (own.status !== 0 || own.stdout.trim()) return false;
      // Each read first: two failed reads would compare equal, as empty.
      const was = changes(reviewed, main);
      const now = changes(head, main);
      return was !== undefined && was === now;
    },
    mergesCleanly(head) {
      if (!fetch(head) || !has(head) || !has("origin/main")) {
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
