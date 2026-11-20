// What the gate reads of a PR, each read or decided here once: its head, its
// checks, and the preview built from that head. Why a failed check failed is
// failed-checks.ts; whether it merges cleanly, git.ts.
import type { Git } from "./git";
import {
  Disconnected,
  type Check,
  type GitHub,
  type PullRequest,
} from "./github";
import { poll, WAITS, type Clock } from "./waits";

export type Reader = { github: GitHub; git: Git; clock: Clock };

/** A command stops here; its message says why and what to do. */
export class Refusal extends Error {}

/**
 * The PR's head. Run from a checkout of the PR's branch, it first waits for
 * GitHub to show the commit checked out here, so a run straight after `git
 * push` reads that commit, not the one before it (#57).
 */
export async function pushedHead(
  pr: number,
  pullRequest: PullRequest,
  { github, git, clock }: Reader
) {
  const { branch } = pullRequest;
  // Outside the branch's checkout there's no local head to wait for.
  const local = git.branch() === branch ? git.head() : undefined;
  // The first try takes the head already read; each after reads it again.
  let head: string | undefined;
  const shown = await poll(WAITS.pushedHead, clock, () => {
    head = head === undefined ? pullRequest.head : github.pullRequest(pr).head;
    return local === undefined || head === local ? head : undefined;
  });
  if (shown === undefined) {
    throw new Refusal(
      `#${pr} is at ${short(head ?? "")} on GitHub, but ${branch} here is at ${short(local ?? "")}; push or pull until they match.`
    );
  }
  return shown;
}

/** A dropped connection reads as undefined, so a poll asks again. */
function readChecks(pr: number, github: GitHub): Check[] | undefined {
  try {
    return github.checks(pr);
  } catch (error) {
    if (error instanceof Disconnected) return undefined;
    throw error;
  }
}

/**
 * The PR's checks once they've appeared and none is pending; none if none
 * appeared. gh alone stops at the first failure while others run, so this
 * waits for every one.
 */
export async function finishedChecks(
  pr: number,
  { github, clock }: Reader
): Promise<Check[]> {
  const appeared = await poll(WAITS.checksAppear, clock, () => {
    const checks = readChecks(pr, github);
    return checks?.length ? checks : undefined;
  });
  if (appeared === undefined) return [];
  const finished = await poll(WAITS.pendingChecks, clock, async () => {
    const checks = await poll(WAITS.disconnected, clock, () =>
      readChecks(pr, github)
    );
    if (checks === undefined) {
      throw new Refusal(
        `Couldn't reach GitHub to read #${pr}'s checks after ${WAITS.disconnected.tries} tries. Run this again once it's back.`
      );
    }
    return checks.some((check) => check.state === "pending")
      ? undefined
      : checks;
  });
  return finished ?? [];
}

export const PREVIEW_JOB = "Preview URL";

export type Preview = { skipped: true } | { skipped: false; url?: string };

/**
 * The preview built from `head`, from the comment the deploy workflow edits on
 * each PR, naming the commit it built. A skipped job posts nothing: a
 * docs-only PR's, a fork's, Dependabot's.
 */
export async function preview(
  pr: number,
  head: string,
  checks: readonly Check[],
  { github, clock }: Reader
): Promise<Preview> {
  if (
    checks.some(
      (check) => check.name === PREVIEW_JOB && check.state === "skipping"
    )
  ) {
    return { skipped: true };
  }
  const built = await poll(WAITS.preview, clock, () => {
    const comment = deployComment(pr, github);
    if (!comment.includes(`Built from ${head}`)) return undefined;
    return { url: comment.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/)?.[0] };
  });
  return { skipped: false, url: built?.url };
}

/** The deploy workflow's comment, or "" until there is one; a failed read asks again. */
function deployComment(pr: number, github: GitHub): string {
  try {
    return (
      github
        .comments(pr)
        .findLast((body) => body.startsWith("<!-- deploy-preview -->")) ?? ""
    );
  } catch {
    return "";
  }
}

export const short = (sha: string) => sha.slice(0, 7);
