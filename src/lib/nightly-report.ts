// What a failed scheduled Nightly tells the tracker (scripts/report-nightly.ts):
// nobody reads a red run in the Actions tab, so it opens an issue.

export const NIGHTLY_ISSUE_TITLE = "Nightly is failing";

// Playwright's name for a failed test, as the GitHub reporter logs it, with
// the rule its heading pads the line with.
const FAILED_TEST = /(\[[a-z]+-[a-z]+\]) › (e2e\/\S+:\d+:\d+ › .+?)[\s─]*$/gm;

const TERMINAL_COLOR = /\u001b\[[0-9;]*m/g;

/** Each failed test a job's log names, once, however often its retries repeat. */
export function failedTests(log: string): string[] {
  const plain = log.replace(TERMINAL_COLOR, "");
  const names = [...plain.matchAll(FAILED_TEST)].map(
    ([, project, test]) => `${project} ${test}`
  );
  return [...new Set(names)];
}

/** The issue text for a failed run, from the logs of its failed jobs. */
export function nightlyReport(runUrl: string, log: string): string {
  const tests = failedTests(log);
  const failures = tests.length
    ? tests.map((test) => `- ${test}`).join("\n")
    : "No test failed by name, so the run stopped before or around them.";
  return [
    `Nightly failed: ${runUrl}`,
    "",
    failures,
    "",
    "If it passes locally but not in CI, docs/testing.md says where to look first. Close this once Nightly passes again.",
  ].join("\n");
}
