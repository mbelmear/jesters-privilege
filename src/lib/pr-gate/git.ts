// The PR gate's view of the local checkout: which commit it has checked out,
// and whether a PR's head merges cleanly with main. Production runs git
// (scripts/pr-gate-git.ts); the gate's tests run it too, in a throwaway clone.

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
