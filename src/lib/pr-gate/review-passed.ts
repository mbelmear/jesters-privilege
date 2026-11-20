// npm run review-passed: record that /code-review passed on a PR's head, as
// the "Code review: passed at <sha>" comment that `merge` and `mark-ready`
// require (review.ts).
import { pushedHead, Refusal, refusalExit, type Reader } from "./snapshot";

export type ReviewPassedGate = Reader & {
  err: (line: string) => void;
  /** An outside command's failure, which says its own error, as gh does. */
  failed: (error: unknown) => void;
};

const USAGE = "Usage: npm run review-passed -- <pr-number> <reviewed full SHA>";

/** Returns the exit code: 0 once recorded, 2 for bad arguments. */
export async function reviewPassed(
  args: readonly string[],
  gate: ReviewPassedGate
): Promise<number> {
  const [prArg = "", reviewed = ""] = args;
  if (
    args.length !== 2 ||
    !/^[0-9]+$/.test(prArg) ||
    !/^[0-9a-f]{40}$/.test(reviewed)
  ) {
    gate.err(USAGE);
    return 2;
  }
  const pr = Number(prArg);
  let head: string;
  try {
    head = await pushedHead(pr, gate.github.pullRequest(pr), gate);
  } catch (error) {
    if (error instanceof Refusal) return refusalExit(error, gate.err);
    // gh says its own error; the caller adds anything more.
    gate.failed(error);
    return 1;
  }
  if (reviewed !== head) {
    // Unfetched, a merge of newer main looks like commits of the PR's own.
    if (!gate.git.fetch(head)) {
      gate.err(`Couldn't fetch main and ${head}; checking what's here.`);
    }
    const since = gate.git.sinceReview(reviewed, head);
    if (since === "merge changes files") {
      // Main's change, or the merge's own, needs the lighter review, not a
      // hand-diff (#114).
      gate.err(
        `Refusing: #${pr}'s head is ${head}, and a merge since ${reviewed} changes the PR's files. Review it with ${reviewed} as the fixed point (docs/testing.md, Merging: a merge of main that changes the PR's files), then record that review at ${head}.`
      );
      return 1;
    }
    if (since === "own commits") {
      gate.err(
        `Refusing: #${pr}'s head is ${head}, but the review was of ${reviewed}. Review the new commits first.`
      );
      return 1;
    }
  }
  gate.github.comment(pr, `Code review: passed at ${reviewed}`);
  return 0;
}
