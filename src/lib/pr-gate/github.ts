// What the PR gate asks GitHub. Production builds it from `gh`
// (scripts/pr-gate-github.ts); tests pass FakeGitHub, so `gh` never runs in the
// gate's tests (#164).

export const PR_STATES = ["OPEN", "CLOSED", "MERGED"] as const;
export type PrState = (typeof PR_STATES)[number];

export type PullRequest = {
  state: PrState;
  branch: string;
  /** The head commit's full SHA. */
  head: string;
};

/** As `gh pr checks` buckets them. */
export const CHECK_STATES = [
  "pass",
  "fail",
  "pending",
  "skipping",
  "cancel",
] as const;
export type CheckState = (typeof CHECK_STATES)[number];

/** What merging a PR would carry: its text, what it closes, and its files. */
export type PrContents = {
  title: string;
  /** "" when it has none. */
  body: string;
  /** The issues GitHub links it to close (closingIssuesReferences). */
  closingIssues: number[];
  /** Each commit's whole message, which the squash merge's body carries. */
  commitMessages: string[];
  /** Every path it changes. */
  files: string[];
};

export type Check = { name: string; state: CheckState; link: string };

/**
 * A PR comment, with its author's association to the repository as GitHub
 * gives it: OWNER, MEMBER and COLLABORATOR have write access; anyone can
 * comment on a public repo, as CONTRIBUTOR, NONE and the rest.
 */
export type Comment = { body: string; association: string };

/** A commit status, which a required status check reads by its context. */
export type CommitStatus = {
  state: "pending" | "success" | "failure";
  /** GitHub keeps 140 characters. */
  description: string;
  /** Where the status links: the run that set it. */
  targetUrl: string;
};

export interface GitHub {
  pullRequest(pr: number): PullRequest;
  /** Every check on the PR's head; none before CI starts. */
  checks(pr: number): Check[];
  contents(pr: number): PrContents;
  /** Each comment, oldest first. */
  comments(pr: number): Comment[];
  comment(pr: number, body: string): void;
  addLabel(pr: number, label: string): void;
  /** Sets the `PR gate` status on a commit. */
  setStatus(sha: string, status: CommitStatus): void;
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
