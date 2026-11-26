// What a failed production deploy, feed check or Start Transcribe tells the tracker
// (scripts/report-deploy.ts). It names a failed smoke check or a step's
// `::error::`. Other steps, such as the build, fail with only an exit code, so
// the report sends the reader to the run.
import { TERMINAL_COLOR } from "./nightly-report";

export const DEPLOY_ISSUE_TITLE = "Production deploy is failing";
export const FEED_CHECK_ISSUE_TITLE = "Feed check is failing";
export const START_TRANSCRIBE_ISSUE_TITLE =
  "Transcribe wasn't started for a new Episode";
// The jobs in deploy.yml this reports on. Each has its own issue: a red feed
// check means nothing new is deploying, not that a deploy went wrong.
export const DEPLOY_JOB = "Deploy to production";
export const FEED_CHECK_JOB = "Feed check";
// Runs after a feed check ships a new Episode (ADR 0004).
export const START_TRANSCRIBE_JOB = "Start Transcribe";

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
    "A feed check that can't read the feed or the live site deploys nothing: no new Episode, Episode Listen link, or Transcript deploys on its own, and the live site stays as it is. One that only found the Worker has stopped starting feed checks still deploys what it found, but a new Episode then waits hours for GitHub's schedule. This issue closes itself once a feed check passes.",
  ].join("\n");
}

/** The issue text for a run whose Start Transcribe job failed. */
export function startTranscribeReport(runUrl: string, log: string): string {
  return [
    `Deploy shipped a new Episode but couldn't start Transcribe: ${runUrl}`,
    "",
    failureList(log),
    "",
    "The Episode is live without its Transcript, which waits for Transcribe's own schedule; press Run workflow on Transcribe to make it now. Close this once Transcribe has run.",
  ].join("\n");
}

/** The comment that closes the feed check's issue. */
export function feedCheckPassed(runUrl: string): string {
  return `A feed check passed: ${runUrl}`;
}

export const REPORTED_JOBS = [
  { job: DEPLOY_JOB, title: DEPLOY_ISSUE_TITLE, report: deployReport },
  {
    job: FEED_CHECK_JOB,
    title: FEED_CHECK_ISSUE_TITLE,
    report: feedCheckReport,
  },
  {
    job: START_TRANSCRIBE_JOB,
    title: START_TRANSCRIBE_ISSUE_TITLE,
    report: startTranscribeReport,
  },
];
