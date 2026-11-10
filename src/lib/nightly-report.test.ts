import { failedTests, nightlyReport } from "./nightly-report";

// A job's log, as Nightly's run of 2026-11-05 printed it: each failure's detail,
// then the closing summary, with a flaky test added to show it's left out.
const LOG = [
  "2026-11-05T17:27:39.2325812Z ##[error]  1) [firefox-phone] › e2e/player.spec.ts:62:7 › Persistent player › offers to resume from any page on a return visit ",
  "2026-11-05T17:27:39.2400000Z     Retry #1 ───────────────────────",
  "2026-11-05T17:30:00.0000000Z ##[error]  3) [firefox-phone] › e2e/theme.spec.ts:9:7 › Theme › passed on a retry ",
  "2026-11-05T17:31:38.5432046Z   2 failed",
  "2026-11-05T17:31:38.5432731Z     [firefox-phone] › e2e/player.spec.ts:62:7 › Persistent player › offers to resume from any page on a return visit ",
  "2026-11-05T17:31:38.5433997Z     [firefox-desktop] › e2e/player.spec.ts:137:7 › Persistent player › works by keyboard, with every control named ",
  "2026-11-05T17:31:38.5434000Z   1 flaky",
  "2026-11-05T17:31:38.5434915Z     [firefox-phone] › e2e/theme.spec.ts:9:7 › Theme › passed on a retry ",
  "2026-11-05T17:31:38.5436531Z   281 passed (5.4m)",
  "2026-11-05T17:31:38.5441988Z ##[notice]  2 failed",
  "    [firefox-phone] › e2e/player.spec.ts:62:7 › Persistent player › offers to resume from any page on a return visit ",
].join("\n");

const RUN = "https://github.com/mbelmear/jesters-privilege/actions/runs/1";

describe("failedTests", () => {
  it("names each failed test once, and none that passed on a retry", () => {
    expect(failedTests(LOG)).toEqual([
      "[firefox-phone] e2e/player.spec.ts:62:7 › Persistent player › offers to resume from any page on a return visit",
      "[firefox-desktop] e2e/player.spec.ts:137:7 › Persistent player › works by keyboard, with every control named",
    ]);
  });

  it("reads a name through the log's terminal colors", () => {
    expect(
      failedTests(
        "\u001b[31m  1 failed\u001b[39m\n    \u001b[31m[firefox-phone] › e2e/a.spec.ts:1:2 › A › fails\u001b[39m"
      )
    ).toEqual(["[firefox-phone] e2e/a.spec.ts:1:2 › A › fails"]);
  });

  it("finds none in a log with no failed test", () => {
    expect(failedTests("2026-11-05T17:27:39Z npm ci failed")).toEqual([]);
  });
});

describe("nightlyReport", () => {
  it("lists the failed tests and links the run", () => {
    const report = nightlyReport(RUN, LOG);
    expect(report).toContain(RUN);
    expect(report).toContain(
      "- [firefox-desktop] e2e/player.spec.ts:137:7 › Persistent player › works by keyboard, with every control named"
    );
  });

  // Nightly's run of 2026-11-10 (#199): a failure's detail, then the summary.
  const TIMEOUT_LOG = [
    "2026-11-10T16:52:54.4790496Z ##[error]  1) [firefox-phone] › e2e/sweep.spec.ts:111:9 › Every button › keeps its contrast while hovered (light) ",
    "    Test timeout of 30000ms exceeded.",
    "2026-11-10T16:56:34.8386587Z   1) [firefox-phone] › e2e/sweep.spec.ts:111:9 › Every button › keeps its contrast while hovered (light) ",
    "2026-11-10T16:56:34.8387836Z ",
    "2026-11-10T16:56:34.8388282Z     Test timeout of 30000ms exceeded.",
    "2026-11-10T16:56:34.8388883Z ",
    "2026-11-10T16:56:34.8389487Z     Error: page.evaluate: Test timeout of 30000ms exceeded.",
    "2026-11-10T16:56:34.8423000Z   1 failed",
    "2026-11-10T16:56:34.8423560Z     [firefox-phone] › e2e/sweep.spec.ts:111:9 › Every button › keeps its contrast while hovered (light) ",
    "2026-11-10T16:56:34.8424307Z   420 passed (8.6m)",
  ].join("\n");

  it("gives each failed test its first error, so a timeout reads as one", () => {
    expect(nightlyReport(RUN, TIMEOUT_LOG)).toContain(
      "- [firefox-phone] e2e/sweep.spec.ts:111:9 › Every button › keeps its contrast while hovered (light): Test timeout of 30000ms exceeded."
    );
  });

  it("says so when the failure came before any test could", () => {
    const report = nightlyReport(RUN, "npm ci failed");
    expect(report).toContain(RUN);
    expect(report).toContain("No test is named");
  });

  // The Email Routing job's log, as GitHub prints its ::error:: lines.
  const EMAIL_ROUTING_LOG = [
    "2026-11-09T09:01:12.0000000Z ##[error]Email Routing check failed: thejestersprivilegepodcast@gmail.com is a destination address but isn't verified",
    "2026-11-09T09:01:12.1000000Z ##[error]Process completed with exit code 1.",
  ].join("\n");

  it("names a failed Email Routing check, and where its fix is", () => {
    const report = nightlyReport(RUN, EMAIL_ROUTING_LOG);
    expect(report).toContain(
      "- Email Routing check failed: thejestersprivilegepodcast@gmail.com is a destination address but isn't verified"
    );
    expect(report).toContain("docs/deploy.md, Account prerequisites");
    expect(report).not.toContain("No test is named");
  });

  it("names failed tests and Email Routing together", () => {
    const report = nightlyReport(RUN, `${LOG}\n${EMAIL_ROUTING_LOG}`);
    expect(report).toContain("- Email Routing check failed:");
    expect(report).toContain(
      "- [firefox-desktop] e2e/player.spec.ts:137:7 › Persistent player › works by keyboard, with every control named"
    );
  });

  // e2e/near-timeout-reporter.ts's ::error:: line, as GitHub prints it.
  const NEAR_TIMEOUT_LOG = [
    "2026-11-11T09:08:00.0000000Z   421 passed (6.2m)",
    "2026-11-11T09:08:00.1000000Z ##[error]Near its timeout: [firefox-phone] e2e/sweep.spec.ts:114:9 › Every button › keeps its contrast while hovered (dark) took 29.5 s of 30 s",
  ].join("\n");

  it("names a test that passed near its timeout, and how to give it time", () => {
    const report = nightlyReport(RUN, NEAR_TIMEOUT_LOG);
    expect(report).toContain(
      "- Near its timeout: [firefox-phone] e2e/sweep.spec.ts:114:9 › Every button › keeps its contrast while hovered (dark) took 29.5 s of 30 s"
    );
    expect(report).toContain("CODING_STANDARDS.md, Browser tests");
    expect(report).not.toContain("No test is named");
  });

  it("leaves the timeout advice out when only tests failed", () => {
    expect(nightlyReport(RUN, LOG)).not.toContain("CODING_STANDARDS.md");
  });

  it("leaves the Email Routing fix out when only tests failed", () => {
    expect(nightlyReport(RUN, LOG)).not.toContain("Account prerequisites");
  });
});
