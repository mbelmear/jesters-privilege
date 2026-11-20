// npm run mark-ready: hand a visual PR to a Jester by adding the
// `ready-for-human` label. Beyond that it only comments, to carry a review
// over a clean merge of main (review.ts). A Jester judges the preview, not the
// code, so first it refuses what a merge refuses: a head without a passed
// review, a PR that would close an issue it doesn't name, a first-screen
// change without its cost. These come before the wait, so they fail in
// seconds, not minutes. Then it waits as pr-status does, and labels only when
// every check passes, the preview is built from the head, and the PR merges
// cleanly with main, so a Jester never reviews a preview that can't merge. A
// push during that wait is refused, as its head was never checked.
import { requireNamedClosures } from "./closing-issues";
import { requireFirstScreenCost, type FirstScreen } from "./first-screen-cost";
import {
  isOpenElseSay,
  waitForHead,
  type Gate,
  type HeadStatus,
} from "./pr-status";
import type { PullRequest } from "./github";
import { requireReview } from "./review";
import {
  builtUrl,
  pushedHead,
  Refusal,
  refusalExit,
  refusing,
  type Action,
} from "./snapshot";

export type MarkReadyGate = Gate & { firstScreen: FirstScreen };

const ACTION: Action = "label";

/** Returns the exit code: 0 once labelled. */
export async function markReady(
  pr: number,
  gate: MarkReadyGate
): Promise<number> {
  try {
    await label(pr, gate);
    return 0;
  } catch (error) {
    return refusalExit(error, gate.err);
  }
}

async function label(pr: number, gate: MarkReadyGate) {
  const { github } = gate;
  const pullRequest = github.pullRequest(pr);
  let head: string;
  try {
    head = await pushedHead(pr, pullRequest, gate);
  } catch (error) {
    if (!(error instanceof Refusal)) throw error;
    // The wait's own message first, so this one's "above" points at it.
    const refusal = refusing(
      ACTION,
      pr,
      "GitHub doesn't show this checkout's commit (see above)."
    );
    throw new Refusal(`${error.message}\n${refusal.message}`);
  }

  requireReview(pr, head, ACTION, gate);
  const contents = github.contents(pr);
  requireNamedClosures(pr, contents, ACTION);
  requireFirstScreenCost(pr, contents, gate.firstScreen, ACTION);

  const status = await waitForPr(pr, pullRequest, head, gate);
  if (!status?.passed) {
    throw refusing(ACTION, pr, "pr-status didn't pass (see above).");
  }
  if (!builtUrl(status.preview)) {
    throw refusing(ACTION, pr, "no preview built from its head yet.");
  }
  if (github.pullRequest(pr).head !== head) {
    throw refusing(
      ACTION,
      pr,
      "its head moved while checks ran; run it again."
    );
  }
  github.addLabel(pr, "ready-for-human");
}

/**
 * pr-status's wait and report, on stderr, as when mark-ready kept
 * pr-status's output for its own checks. Undefined if it didn't finish: a
 * closed PR, or an error, said as pr-status says one on its way out.
 */
async function waitForPr(
  pr: number,
  pullRequest: PullRequest,
  head: string,
  gate: Gate
): Promise<HeadStatus | undefined> {
  const status = { ...gate, out: gate.err };
  if (!isOpenElseSay(pr, pullRequest, status.out)) return undefined;
  try {
    return await waitForHead(pr, head, status);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const lines = message.split("\n");
    (error instanceof Refusal ? lines : lines.slice(0, 1)).forEach(gate.err);
    return undefined;
  }
}
