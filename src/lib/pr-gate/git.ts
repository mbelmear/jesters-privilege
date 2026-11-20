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
  /** Fetches main and `head` from origin; false if that failed. */
  fetch(head: string): boolean;
  /** Whether `ancestor` is part of `commit`'s history. */
  isAncestor(ancestor: string, commit: string): boolean;
  /**
   * Whether everything after `reviewed` up to `head` is merges of origin/main
   * that leave the PR's own changes as they were, so a review of `reviewed`
   * still holds. The pre-push hook makes a branch merge main whenever main
   * has moved, which with several sessions merging is most pushes.
   *
   * It compares the blobs of every file the PR changes, before and after, so
   * main touching one of those files, or a merge commit adding a change of
   * its own, says no. What it can't see is main changing something the PR
   * relies on in another file; CI runs on the merged code.
   * scripts/merged-main-only.sh, which review-passed still runs, does the
   * same; one test holds both to the same cases.
   */
  mergedMainOnly(reviewed: string, head: string): boolean;
}
