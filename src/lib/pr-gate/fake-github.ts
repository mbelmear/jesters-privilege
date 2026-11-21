// An in-memory GitHub for the PR gate's tests. A test sets what GitHub shows
// and changes it as the gate waits (fakeClock's onSleep).
import {
  Disconnected,
  type Association,
  type Check,
  type Comment,
  type CommitStatus,
  type GitHub,
  type PrContents,
  type PullRequest,
} from "./github";

export class FakeGitHub implements GitHub {
  checkList: Check[] = [];
  /** Every comment, those the gate posts included. */
  commentBodies: string[] = [];
  /**
   * Each comment's author association, by body. Made up: OWNER unless set
   * here, as Michael posts the reviews.
   */
  associations: Record<string, Association> = {};
  /** A read of the comments throws this, if set. */
  commentsFail?: Error;
  /** Every status the gate set, in order. */
  statuses: (CommitStatus & { sha: string })[] = [];
  /** The labels the gate added. */
  labels: string[] = [];
  prContents: PrContents = {
    title: "A ticket (#158)",
    body: "Closes #158.",
    closingIssues: [158],
    commitMessages: ["Ticket"],
    files: ["ticket.md"],
  };
  /** Logs by job id; a job missing here can't be read. */
  logs: Record<string, string> = {};
  /** How main's head ran each check; a check missing here can't be read. */
  main: Record<string, string> = {};
  /** How many reads of the checks drop their connection before one connects. */
  dropped = 0;

  constructor(public pr: PullRequest) {}

  pullRequest(): PullRequest {
    return { ...this.pr };
  }

  checks(): Check[] {
    if (this.dropped > 0) {
      this.dropped -= 1;
      throw new Disconnected("error connecting to api.github.com");
    }
    return this.checkList.map((check) => ({ ...check }));
  }

  contents(): PrContents {
    return structuredClone(this.prContents);
  }

  comments(): Comment[] {
    if (this.commentsFail) throw this.commentsFail;
    return this.commentBodies.map((body) => ({
      body,
      association: this.associations[body] ?? "OWNER",
    }));
  }

  comment(_pr: number, body: string): void {
    this.commentBodies.push(body);
  }

  addLabel(_pr: number, label: string): void {
    this.labels.push(label);
  }

  setStatus(sha: string, status: CommitStatus): void {
    this.statuses.push({ sha, ...status });
  }

  jobLog(repo: string, job: string): string {
    const log = this.logs[job];
    if (log === undefined) throw new Error(`HTTP 404: ${repo} job ${job}`);
    return log;
  }

  mainCheck(name: string): string {
    const conclusion = this.main[name];
    if (conclusion === undefined) throw new Error(`HTTP 500: ${name}`);
    return conclusion;
  }
}
