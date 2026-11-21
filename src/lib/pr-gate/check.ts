// The PR gate check: the `PR gate` commit status on a PR's head, which the
// `Protect main` ruleset requires, so GitHub's merge button waits for it
// (#262). The PR gate workflow runs it from main's code
// (scripts/pr-gate-check.ts) whenever the PR or its comments change.
import { requireNamedClosures } from "./closing-issues";
import { requireFirstScreenCost, type FirstScreen } from "./first-screen-cost";
import type { CommitStatus } from "./github";
import type { Gate } from "./pr-status";
import { requireReview } from "./review";
import { Refusal, refusalExit, short } from "./snapshot";

export type CheckGate = Gate & {
  firstScreen: FirstScreen;
  /** The run setting the status, which it links to. */
  targetUrl: string;
};

/** Returns the exit code. */
export function prGateCheck(pr: number, gate: CheckGate): number {
  const { github, targetUrl } = gate;
  const { head } = github.pullRequest(pr);
  const set = (state: CommitStatus["state"], description: string) =>
    github.setStatus(head, { state, description, targetUrl });

  set("pending", "Checking the review, closing issues and first-screen cost");
  try {
    requireReview(pr, head, "merge", gate, "throw");
    const contents = github.contents(pr);
    requireNamedClosures(pr, contents, "merge");
    requireFirstScreenCost(pr, contents, gate.firstScreen, "merge");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof Refusal) {
      // A refusal is the check working: the status says it, the run passes.
      refusalExit(error, gate.err);
      set("failure", fitted(firstLine(message)));
      return 0;
    }
    // A read that failed: loud, in the status and the run, and never a pass.
    const failed = `Couldn't check #${pr}: ${firstLine(message)}`;
    gate.err(failed);
    set("failure", fitted(failed));
    return 1;
  }
  set(
    "success",
    `Reviewed at ${short(head)}; closes only what it names; first-screen cost shown or not needed`
  );
  return 0;
}

// A status's description is cut to 140 characters, a short line beside the
// check's name. #262 gave 140 as GitHub's limit; GitHub's REST docs for
// commit statuses (read 2026-11-21) give none, so the cut relies on none.
const KEPT = 140;

const firstLine = (text: string) => text.split("\n")[0] ?? "";

/** The line whole if it fits, else cut to fit with "…". */
const fitted = (line: string) =>
  line.length <= KEPT ? line : `${line.slice(0, KEPT - 1)}…`;
