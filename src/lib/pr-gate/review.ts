// The review rule `merge` and `mark-ready` share: a PR's head needs a passed
// /code-review, recorded as a "Code review: passed at <sha>" comment
// (`npm run review-passed`). A head that adds only clean merges of main keeps
// its review, recorded as a comment on that head for the post-merge audit
// (scripts/audit-merge.sh), which reads the line through
// scripts/last-reviewed-sha.sh; a test holds the two to the same reading.
import type { Gate } from "./pr-status";
import { refusing, type Action } from "./snapshot";

const PASSED = /^Code review: passed at ([0-9a-f]{40})/;

/** The commit the newest "Code review: passed at <sha>" line names, in any comment. */
export function lastReviewed(comments: readonly string[]): string | undefined {
  return comments
    .flatMap((body) => body.split("\n"))
    .flatMap((line) => PASSED.exec(line)?.[1] ?? [])
    .at(-1);
}

/**
 * Passes a head the newest passed review names, or one only clean merges of
 * main follow, recording that review on the head. Otherwise refuses, saying
 * which commits still need a review.
 */
export function requireReview(
  pr: number,
  head: string,
  action: Action,
  { github, git, err }: Gate
) {
  const reviewed = lastReviewed(github.comments(pr));
  if (reviewed === head) return;
  if (reviewed) {
    // Unfetched, a merge of newer main looks like commits of the PR's own,
    // and the check below refuses.
    if (!git.fetch(head)) {
      err(`Couldn't fetch main and ${head}; checking what's here.`);
    }
    if (git.mergedMainOnly(reviewed, head)) {
      github.comment(
        pr,
        `Code review: passed at ${head} (carried over from ${reviewed}: only clean merges of main since)`
      );
      return;
    }
  }
  // Review only the new commits, unless a rebase dropped the reviewed one.
  const since =
    reviewed && git.isAncestor(reviewed, head) ? reviewed : "origin/main";
  throw refusing(
    action,
    pr,
    `head is ${head}, but the last passed review is at ${reviewed ?? "no commit"}.`,
    `Review it (docs/testing.md, Merging) with ${since} as the fixed point, then: npm run review-passed -- ${pr} ${head}`
  );
}
