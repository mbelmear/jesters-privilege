// An in-memory GitHub for the PR gate's tests. A test sets what GitHub shows
// and changes it as the gate waits (fakeClock's onSleep).
import {
  Disconnected,
  type Check,
  type GitHub,
  type PullRequest,
} from "./github";

export class FakeGitHub implements GitHub {
  checkList: Check[] = [];
  commentBodies: string[] = [];
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

  comments(): string[] {
    return [...this.commentBodies];
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
