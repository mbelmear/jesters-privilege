// npm run pr-status: wait for a PR's head to finish CI and get its preview,
// then report every check, the preview built from that head, and whether it
// merges cleanly with main. Read-only.
import { anyFailed, failedCheckReport } from "./failed-checks";
import type { MergesCleanly } from "./git";
import type { Check, CheckState } from "./github";
import {
  finishedChecks,
  preview,
  pushedHead,
  Refusal,
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
const TABLE_ORDER: readonly CheckState[] = [
  "fail",
  "cancel",
  "pending",
  "pass",
  "skipping",
];
const asGhTable = (a: Check, b: Check) =>
  TABLE_ORDER.indexOf(a.state) - TABLE_ORDER.indexOf(b.state) ||
  a.name.localeCompare(b.name, "en");

/** Returns the exit code: 0 when every check passed and it merges cleanly. */
export async function prStatus(pr: number, gate: Gate): Promise<number> {
  try {
    return await report(pr, gate);
  } catch (error) {
    if (!(error instanceof Refusal)) throw error;
    gate.err(error.message);
    return 1;
  }
}

async function report(pr: number, gate: Gate): Promise<number> {
  const { github, git, out } = gate;
  const read = github.pullRequest(pr);
  if (read.state !== "OPEN") {
    out(`#${pr} is ${read.state}; nothing to wait for.`);
    return 1;
  }
  const head = await pushedHead(pr, read, gate);
  out(`#${pr} at ${short(head)}`);

  // A PR that already conflicts would only be refused after the checks, so say
  // so now. Main can still move during the wait, so it's asked again at the end.
  if (git.mergesCleanly(head) === "no") {
    out(
      "Merges cleanly with main: no (CONFLICTING); merge origin/main in and push first."
    );
    return 1;
  }

  const checks = await finishedChecks(pr, gate);
  if (!checks.length) {
    gate.err(
      `No checks reported on #${pr} yet; wait for CI to start, then run this again.`
    );
    return 1;
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
  return passed && merges === "yes" ? 0 : 1;
}
