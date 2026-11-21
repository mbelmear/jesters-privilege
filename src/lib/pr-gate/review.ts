// The review rule the PR gate check (check.ts) and `mark-ready` share: a PR's head needs a passed
// /code-review, recorded as a "Code review: passed at <sha>" comment
// (`npm run review-passed`). A head that adds only clean merges of main keeps
// its review, recorded as a comment on that head for the post-merge audit
// (scripts/audit-merge.sh), which reads the line through
// scripts/last-reviewed-sha.sh; a test holds the two to the same reading.
import type { Gate } from "./pr-status";
import { refusing, type Action } from "./snapshot";

const PASSED = /^Code review: passed at ([0-9a-f]{40})/;

// The associations with write access. Anyone can comment on a public repo,
// so only these accounts' reviews count.
const WRITERS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

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
  const comments = github.comments(pr);
  const reviewed = lastReviewed(
    comments
      .filter(({ association }) => WRITERS.has(association))
      .map(({ body }) => body)
  );
  if (reviewed === head) return;
  if (reviewed) {
    // Unfetched, a merge of newer main looks like commits of the PR's own,
    // and the check below refuses.
    if (!git.fetch(head)) {
      err(`Couldn't fetch main and ${head}; checking what's here.`);
    }
    if (git.sinceReview(reviewed, head) === "clean merges") {
      const carried = `Code review: passed at ${head} (carried over from ${reviewed}: only clean merges of main since)`;
      // The PR gate workflow posts it as github-actions[bot], which isn't a
      // writer, so the next run carries the same review again: once is enough.
      // A new comment, not an edit of the last: the audit reads the newest
      // passed line, and an edited comment keeps its place among the rest.
      if (!comments.some(({ body }) => body === carried)) {
        github.comment(pr, carried);
      }
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
