import { failedTests, nightlyReport } from "./nightly-report";

// Lines as a job's log holds them, from Nightly's run of 2026-11-05.
const LOG = [
  "2026-11-05T17:27:39.2325812Z ##[error]  1) [firefox-phone] › e2e/player.spec.ts:62:7 › Persistent player › offers to resume from any page on a return visit ",
  "2026-11-05T17:27:39.2351196Z ##[error]  1) [firefox-phone] › e2e/player.spec.ts:62:7 › Persistent player › offers to resume from any page on a return visit ",
  "2026-11-05T17:27:39.2400000Z     Retry #1 ───────────────────────",
  "2026-11-05T17:28:53.1116547Z ##[error]  2) [firefox-desktop] › e2e/player.spec.ts:137:7 › Persistent player › works by keyboard, with every control named ─────",
  "2026-11-05T17:29:00.0000000Z   2 failed",
].join("\n");

const RUN = "https://github.com/mbelmear/jesters-privilege/actions/runs/1";

describe("failedTests", () => {
  it("names each failed test once, whatever its retries repeat", () => {
    expect(failedTests(LOG)).toEqual([
      "[firefox-phone] e2e/player.spec.ts:62:7 › Persistent player › offers to resume from any page on a return visit",
      "[firefox-desktop] e2e/player.spec.ts:137:7 › Persistent player › works by keyboard, with every control named",
    ]);
  });

  it("reads a name through the log's terminal colors", () => {
    expect(
      failedTests(
        "\u001b[31m[firefox-phone] › e2e/a.spec.ts:1:2 › A › fails\u001b[39m"
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

  it("says so when the failure came before any test could", () => {
    const report = nightlyReport(RUN, "npm ci failed");
    expect(report).toContain(RUN);
    expect(report).toContain("No test failed by name");
  });
});
