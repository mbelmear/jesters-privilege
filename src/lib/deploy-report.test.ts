import { readFileSync } from "node:fs";
import { DEPLOY_JOB, deployFailures, deployReport } from "./deploy-report";

const RUN = "https://github.com/mbelmear/jesters-privilege/actions/runs/1";

describe("deployFailures", () => {
  it("names the smoke check that failed", () => {
    expect(
      deployFailures(
        [
          "2026-11-06T03:00:48.6807186Z Run scripts/smoke-check.sh abc",
          "2026-11-06T03:01:48.6807186Z Smoke check failed: http_redirects_to_https",
          "2026-11-06T03:01:48.6900000Z ##[error]Process completed with exit code 1.",
        ].join("\n")
      )
    ).toEqual(["Smoke check failed: http_redirects_to_https"]);
  });

  it("reads an error through the log's terminal colors, once each", () => {
    const line =
      "2026-11-06T03:00:00.0000000Z ##[error]\u001b[31mThe build needs a Turnstile key\u001b[39m";
    expect(deployFailures(`${line}\n${line}`)).toEqual([
      "The build needs a Turnstile key",
    ]);
  });

  it("finds none in a log that only gives an exit code", () => {
    expect(
      deployFailures(
        "2026-11-06T03:00:00.0000000Z ##[error]Process completed with exit code 1."
      )
    ).toEqual([]);
  });
});

describe("deployReport", () => {
  it("links the run, lists the failures, and says what is live", () => {
    const report = deployReport(RUN, "Z Smoke check failed: home_page_serves");
    expect(report).toContain(`The production deploy failed: ${RUN}`);
    expect(report).toContain("- Smoke check failed: home_page_serves");
    expect(report).toContain("already live");
    expect(report).toContain("last good deploy stays live");
  });

  it("says so when the logs name no failure", () => {
    expect(deployReport(RUN, "")).toContain("No failure is named");
  });
});

// A rename in either file would silently stop every report.
describe("the workflows it reads", () => {
  it("names the production job and workflow as they are written", () => {
    const deploy = readFileSync(".github/workflows/deploy.yml", "utf8");
    expect(deploy).toContain(`name: ${DEPLOY_JOB}\n`);
    expect(deploy).toMatch(/^name: Deploy$/m);
    expect(
      readFileSync(".github/workflows/deploy-report.yml", "utf8")
    ).toContain("workflows: [Deploy]");
  });
});
