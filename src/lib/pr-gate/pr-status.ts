// npm run pr-status: wait for a PR's head to finish CI and get its preview,
// then report every check, the preview built from that head, and whether it
// merges cleanly with main. Read-only.
import { anyFailed, failedCheckReport } from "./failed-checks";
import type { MergesCleanly } from "./git";
import type { Check, CheckState, PullRequest } from "./github";
import {
  finishedChecks,
  preview,
  pushedHead,
  Refusal,
  type Preview,
  short,
  type Reader,
} from "./snapshot";

export type Gate = Reader & {
  out: (line: string) => void;
  err: (line: string) => void;
};

const MERGES: Record<MergesCleanly, string> = {
  yes: "yes",
  no: "no (CONFLICTING)",
  unknown: "unknown (couldn't fetch)",
};

// gh's own table puts what needs looking at first, then sorts by name; its
// JSON, which the gate reads, comes in no order.
const TABLE_ORDER: Record<CheckState, number> = {
  fail: 0,
  cancel: 1,
  pending: 2,
  pass: 3,
  skipping: 4,
};
const asGhTable = (a: Check, b: Check) =>
  TABLE_ORDER[a.state] - TABLE_ORDER[b.state] || byByte(a.name, b.name);

// As Go compares strings, which gh does: capitals sort before lower case.
const byByte = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Returns the exit code: 0 when every check passed and it merges cleanly. */
export async function prStatus(pr: number, gate: Gate): Promise<number> {
  try {
    return await report(pr, gate);
  } catch (error) {
    if (!(error instanceof Refusal)) throw error;
    error.message.split("\n").forEach(gate.err);
    return 1;
  }
}

async function report(pr: number, gate: Gate): Promise<number> {
  const pullRequest = gate.github.pullRequest(pr);
  if (!isOpen(pr, pullRequest, gate.out)) return 1;
  const head = await pushedHead(pr, pullRequest, gate);
  return (await waitForHead(pr, head, gate)).passed ? 0 : 1;
}

/** Says so of a PR that isn't open: nothing to wait for. */
export function isOpen(
  pr: number,
  { state }: PullRequest,
  say: (line: string) => void
): boolean {
  if (state === "OPEN") return true;
  say(`#${pr} is ${state}; nothing to wait for.`);
  return false;
}

export type HeadStatus = { passed: boolean; preview?: Preview };

/**
 * Waits for `head`'s checks and preview, reporting each, then whether it
 * merges cleanly. Passed when every check passed and it merges cleanly.
 */
export async function waitForHead(
  pr: number,
  head: string,
  gate: Gate
): Promise<HeadStatus> {
  const { github, git, out } = gate;
  out(`#${pr} at ${short(head)}`);

  // A PR that already conflicts would only be refused after the checks, so say
  // so now. Main can still move during the wait, so it's asked again at the end.
  if (git.mergesCleanly(head) === "no") {
    out(
      "Merges cleanly with main: no (CONFLICTING); merge origin/main in and push first."
    );
    return { passed: false };
  }

  const checks = await finishedChecks(pr, gate);
  if (!checks.length) {
    gate.err(
      `No checks reported on #${pr} yet; wait for CI to start, then run this again.`
    );
    return { passed: false };
  }
  const passed = !anyFailed(checks);
  if (!passed) failedCheckReport(checks, github).forEach(gate.err);
  for (const check of [...checks].sort(asGhTable)) {
    out(`${check.name}\t${check.state}`);
  }

  const built = await preview(pr, head, checks, gate);
  out(
    built.skipped
      ? "Preview: none, its job was skipped"
      : `Preview: ${built.url ?? `none built from ${short(head)} yet`}`
  );

  const merges = git.mergesCleanly(head);
  out(`Merges cleanly with main: ${MERGES[merges]}`);
  return { passed: passed && merges === "yes", preview: built };
}
