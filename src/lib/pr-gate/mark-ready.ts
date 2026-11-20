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
import { isOpen, waitForHead, type Gate } from "./pr-status";
import { requireReview } from "./review";
import { pushedHead, Refusal } from "./snapshot";

export type MarkReadyGate = Gate & { firstScreen: FirstScreen };

const ACTION = "label";

/** Returns the exit code: 0 once labelled. */
export async function markReady(
  pr: number,
  gate: MarkReadyGate
): Promise<number> {
  try {
    await label(pr, gate);
    return 0;
  } catch (error) {
    if (!(error instanceof Refusal)) throw error;
    error.message.split("\n").forEach(gate.err);
    return 1;
  }
}

async function label(pr: number, gate: MarkReadyGate) {
  const { github } = gate;
  const refuse = (why: string) =>
    new Refusal(`Refusing to label #${pr}: ${why}`);

  const pullRequest = github.pullRequest(pr);
  let head: string;
  try {
    head = await pushedHead(pr, pullRequest, gate);
  } catch (error) {
    if (!(error instanceof Refusal)) throw error;
    throw new Refusal(
      `${error.message}\n${refuse("GitHub doesn't show this checkout's commit (see above).").message}`
    );
  }

  requireReview(pr, head, ACTION, gate);
  const contents = github.contents(pr);
  requireNamedClosures(pr, contents, ACTION);
  requireFirstScreenCost(pr, contents, gate.firstScreen, ACTION);

  // The report goes to stderr, as it did when pr-status's output was kept for these checks.
  const status = { ...gate, out: gate.err };
  const passed =
    isOpen(pr, pullRequest, status.out) &&
    (await waitForHead(pr, head, status));
  if (!passed || !passed.passed) {
    throw refuse("pr-status didn't pass (see above).");
  }
  if (passed.preview?.skipped !== false || !passed.preview.url) {
    throw refuse("no preview built from its head yet.");
  }
  if (github.pullRequest(pr).head !== head) {
    throw refuse("its head moved while checks ran; run it again.");
  }
  github.addLabel(pr, "ready-for-human");
}
