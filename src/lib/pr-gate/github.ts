// What the PR gate asks GitHub. Production builds it from `gh`
// (scripts/pr-gate-github.ts); tests pass FakeGitHub, so `gh` never runs in the
// gate's tests (#164).

export type PullRequest = {
  /** OPEN, CLOSED or MERGED. */
  state: string;
  branch: string;
  /** The head commit's full SHA. */
  head: string;
};

/** As `gh pr checks` buckets them. */
export type CheckState = "pass" | "fail" | "pending" | "skipping" | "cancel";

export type Check = { name: string; state: CheckState; link: string };

export interface GitHub {
  pullRequest(pr: number): PullRequest;
  /** Every check on the PR's head; none before CI starts. */
  checks(pr: number): Check[];
  /** Each comment's body, oldest first. */
  comments(pr: number): string[];
  /** A job's log, as the jobs API serves it. */
  jobLog(repo: string, job: string): string;
  /**
   * How main's head last ran a check: its conclusion (such as "failure" or
   * "success"), "pending" while it runs, or "none" if it hasn't run it.
   */
  mainCheck(name: string): string;
}

/** `gh` couldn't reach GitHub: a dropped connection or a laptop's sleep. */
export class Disconnected extends Error {}
