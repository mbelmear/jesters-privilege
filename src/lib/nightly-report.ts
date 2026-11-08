// What a failed scheduled Nightly tells the tracker (scripts/report-nightly.ts):
// nobody reads a red run in the Actions tab, so it opens an issue.
import { EMAIL_ROUTING_FAILURE } from "./email-routing-check";

export const NIGHTLY_ISSUE_TITLE = "Nightly is failing";

export const TERMINAL_COLOR = /\u001b\[[0-9;]*m/g;
// The heading of Playwright's closing summary. Failures' details come first,
// and they name a test that passed on a retry too, so only this is read.
const FAILED_HEADING = /\s\d+ failed\s*$/;
const LISTED_TEST = /(\[[a-z]+-[a-z]+\]) › (e2e\/\S+:\d+:\d+ › .+?)\s*$/;

/** Each test a job's log lists as failed, as its closing summary lists them. */
export function failedTests(log: string): string[] {
  const lines = log.replace(TERMINAL_COLOR, "").split("\n");
  const start = lines.findIndex((line) => FAILED_HEADING.test(line));
  if (start === -1) return [];
  const tests: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const listed = LISTED_TEST.exec(line);
    if (!listed) break;
    tests.push(`${listed[1]} ${listed[2]}`);
  }
  return tests;
}

const EMAIL_ROUTING_ERROR = new RegExp(
  `##\\[error\\](${EMAIL_ROUTING_FAILURE}: .+?)\\s*$`
);

/** Each problem a job's log names from the Email Routing check. */
function emailRoutingFailures(log: string): string[] {
  return log
    .replace(TERMINAL_COLOR, "")
    .split("\n")
    .flatMap((line) => EMAIL_ROUTING_ERROR.exec(line)?.[1] ?? []);
}

/** The issue text for a failed run, from the logs of its failed jobs. */
export function nightlyReport(runUrl: string, log: string): string {
  const tests = failedTests(log);
  const emailRouting = emailRoutingFailures(log);
  const failures = [...tests, ...emailRouting];
  return [
    `Nightly failed: ${runUrl}`,
    "",
    failures.length
      ? failures.map((failure) => `- ${failure}`).join("\n")
      : "No test is named: the run stopped before its tests finished, or its logs couldn't be read.",
    "",
    ...(emailRouting.length
      ? [
          "docs/deploy.md, Account prerequisites, says how Email Routing should be set up in the Cloudflare dashboard.",
        ]
      : []),
    "If it passes locally but not in CI, docs/testing.md says where to look first. Close this once Nightly passes again.",
  ].join("\n");
}
