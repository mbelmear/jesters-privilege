// What a failed production deploy or feed check tells the tracker
// (scripts/report-deploy.ts). It names a failed smoke check or a step's
// `::error::`. Other steps, such as the build, fail with only an exit code, so
// the report sends the reader to the run.
import { TERMINAL_COLOR } from "./nightly-report";

export const DEPLOY_ISSUE_TITLE = "Production deploy is failing";
export const FEED_CHECK_ISSUE_TITLE = "Feed check is failing";
// The jobs in deploy.yml this reports on. Each has its own issue: a red feed
// check means nothing new is deploying, not that a deploy went wrong.
export const DEPLOY_JOB = "Deploy to production";
export const FEED_CHECK_JOB = "Feed check";

const SMOKE_CHECK = /Smoke check failed: \S+/;
const STEP_ERROR = /##\[error\](.+)$/;
const EXIT_CODE_ONLY = /^Process completed with exit code \d+\.?\s*$/;

/** Each distinct failure a reported job's log names. */
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

function failureList(log: string): string {
  const failures = deployFailures(log);
  return failures.length
    ? failures.map((failure) => `- ${failure}`).join("\n")
    : "No failure is named: read the run's logs.";
}

/** The issue text for a failed run, from its deploy job's log. */
export function deployReport(runUrl: string, log: string): string {
  return [
    `The production deploy failed: ${runUrl}`,
    "",
    failureList(log),
    "",
    "A failed smoke check comes after `wrangler deploy`, so check what the site is serving. Any earlier failure means the last good deploy stays live. Close this once a deploy passes again.",
  ].join("\n");
}

/** The issue text for a failed run, from its feed check job's log. */
export function feedCheckReport(runUrl: string, log: string): string {
  return [
    `The feed check failed: ${runUrl}`,
    "",
    failureList(log),
    "",
    "While the feed check is red, no new Episode, Episode Listen link, or Transcript deploys on its own, and the live site stays as it is. Close this once a feed check passes again.",
  ].join("\n");
}
