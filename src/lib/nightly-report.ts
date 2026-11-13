// What a failed scheduled Nightly tells the tracker (scripts/report-nightly.ts):
// nobody reads a red run in the Actions tab, so it opens an issue.
import { EMAIL_ROUTING_FAILURE } from "./email-routing-check";
import { NEAR_TIMEOUT } from "./near-timeout";

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

const TIMESTAMP = /^\d{4}-\d\d-\d\dT\S+Z ?/;

/**
 * A failed test's first error, from its detail ("1) [project] › test", then
 * the error), so a timeout reads as one: #199's "keeps its contrast" failed
 * on a timeout, not on contrast.
 */
function firstError(log: string, test: string): string | undefined {
  const heading = `) ${test.replace(/^(\[[a-z]+-[a-z]+\]) /, "$1 › ")}`;
  const lines = log
    .replace(TERMINAL_COLOR, "")
    .split("\n")
    .map((line) => line.replace(TIMESTAMP, "").trim());
  const start = lines.findIndex((line) => line.endsWith(heading));
  if (start === -1) return undefined;
  return lines.slice(start + 1).find((line) => line !== "");
}

/** Each ::error:: line in a job's log that starts with the given words. */
function errorsStarting(words: string, log: string): string[] {
  const error = new RegExp(`##\\[error\\](${words}: .+?)\\s*$`);
  return log
    .replace(TERMINAL_COLOR, "")
    .split("\n")
    .flatMap((line) => error.exec(line)?.[1] ?? []);
}

// zizmor --format github's finding as GitHub prints it: its file and line,
// then the problem. The rule's name, the annotation's title, isn't printed.
const ZIZMOR_FINDING = /##\[error\]([\w.-]+\.ya?ml:\d+: .+?)\s*$/;

/** Each finding zizmor's annotations put in a job's log as an error. */
function zizmorFindings(log: string): string[] {
  return log
    .replace(TERMINAL_COLOR, "")
    .split("\n")
    .flatMap((line) => {
      const finding = ZIZMOR_FINDING.exec(line)?.[1];
      return finding ? [`zizmor: ${finding}`] : [];
    });
}

/** The issue text for a failed run, from the logs of its failed jobs. */
export function nightlyReport(runUrl: string, log: string): string {
  const tests = failedTests(log).map((test) => {
    const error = firstError(log, test);
    return error ? `${test}: ${error}` : test;
  });
  const nearTimeout = errorsStarting(NEAR_TIMEOUT, log);
  const emailRouting = errorsStarting(EMAIL_ROUTING_FAILURE, log);
  const zizmor = zizmorFindings(log);
  const failures = [...tests, ...nearTimeout, ...emailRouting, ...zizmor];
  return [
    `Nightly failed: ${runUrl}`,
    "",
    failures.length
      ? failures.map((failure) => `- ${failure}`).join("\n")
      : "No test is named: the run stopped before its tests finished, or its logs couldn't be read.",
    "",
    ...(nearTimeout.length
      ? [
          "A test near its timeout passed this time and fails on a slower runner. CODING_STANDARDS.md, Browser tests, says how to give it the time it needs.",
        ]
      : []),
    ...(emailRouting.length
      ? [
          "docs/deploy.md, Account prerequisites, says how Email Routing should be set up in the Cloudflare dashboard.",
        ]
      : []),
    ...(zizmor.length
      ? [
          "docs/testing.md, Formatting, linting, and types, says how to fix a zizmor finding or mark one safe.",
        ]
      : []),
    "If it passes locally but not in CI, docs/testing.md says where to look first. Close this once Nightly passes again.",
  ].join("\n");
}
