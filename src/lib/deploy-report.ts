// What a failed production deploy tells the tracker (scripts/report-deploy.ts).
// It names a failed smoke check or a step's `::error::`. Other steps, such as the
// build, fail with only an exit code, so the report sends the reader to the run.
import { TERMINAL_COLOR } from "./nightly-report";

export const DEPLOY_ISSUE_TITLE = "Production deploy is failing";
// The job in deploy.yml this reports on. The feed check runs again within 2
// hours and nothing deploys while it's red, so it stays out of the tracker.
export const DEPLOY_JOB = "Deploy to production";

const SMOKE_CHECK = /Smoke check failed: \S+/;
const STEP_ERROR = /##\[error\](.+)$/;
const EXIT_CODE_ONLY = /^Process completed with exit code \d+\.?\s*$/;

/** Each distinct failure a deploy job's log names. */
export function deployFailures(log: string): string[] {
  const failures = log
    .replace(TERMINAL_COLOR, "")
    .split("\n")
    .flatMap((line) => {
      const smoke = SMOKE_CHECK.exec(line);
      if (smoke) return [smoke[0]];
      const error = STEP_ERROR.exec(line)?.[1]?.trim();
      return error && !EXIT_CODE_ONLY.test(error) ? [error] : [];
    });
  return [...new Set(failures)];
}

/** The issue text for a failed run, from its deploy job's log. */
export function deployReport(runUrl: string, log: string): string {
  const failures = deployFailures(log);
  return [
    `The production deploy failed: ${runUrl}`,
    "",
    failures.length
      ? failures.map((failure) => `- ${failure}`).join("\n")
      : "No failure is named: read the run's logs.",
    "",
    "A failed smoke check comes after `wrangler deploy`, so check what the site is serving. Any earlier failure means the last good deploy stays live. Close this once a deploy passes again.",
  ].join("\n");
}
