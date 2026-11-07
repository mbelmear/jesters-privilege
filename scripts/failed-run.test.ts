import { execFileSync } from "node:child_process";
import { closeReport, failedJobs, fileReport, passedJobs } from "./failed-run";

// Fakes the process call itself, so no test here can reach GitHub. failed-run.ts
// spawns `gh` without an `env`, so a stub on a PATH set in Jest, whose
// `process.env` is a copy, is never found: the first version of this file opened
// real issues.
jest.mock("node:child_process", () => ({ execFileSync: jest.fn() }));

const TITLE = "Feed check is failing";
const calls: string[] = [];
let openIssue = "";

function answer(args: readonly string[]): string {
  const call = args.join(" ");
  calls.push(call);
  if (call.startsWith("issue list")) return `${openIssue}\n`;
  if (call.includes('"failure"')) return "1\tFeed check\n";
  if (call.includes('"success"')) return "2\tDeploy to production\n";
  return "";
}

beforeEach(() => {
  calls.length = 0;
  openIssue = "";
  jest
    .mocked(execFileSync)
    .mockImplementation(((_file: string, args: readonly string[]) =>
      answer(args)) as typeof execFileSync);
});

const writes = () => calls.filter((call) => !call.startsWith("issue list"));

describe("fileReport", () => {
  it("opens an issue, marked for triage, when none is open", () => {
    fileReport(TITLE, "It failed", false);
    expect(writes()).toEqual([
      `issue create --title=${TITLE} --body=It failed --label=needs-triage`,
    ]);
  });

  it("comments on the issue still open", () => {
    openIssue = "7";
    fileReport(TITLE, "It failed", false);
    expect(writes()).toEqual(["issue comment 7 --body=It failed"]);
  });

  it("writes nothing on a dry run", () => {
    const log = jest.spyOn(console, "log").mockImplementation();
    fileReport(TITLE, "It failed", true);
    expect(log).toHaveBeenCalledWith("It failed");
    log.mockRestore();
    expect(writes()).toEqual([]);
  });
});

describe("closeReport", () => {
  it("closes the issue still open, saying why", () => {
    openIssue = "7";
    closeReport(TITLE, "It passed");
    expect(writes()).toEqual(["issue close 7 --comment=It passed"]);
  });

  it("does nothing when none is open", () => {
    closeReport(TITLE, "It passed");
    expect(writes()).toEqual([]);
  });
});

describe("a run's jobs", () => {
  it("are told apart by how they ended", () => {
    expect(failedJobs("1")).toEqual([{ id: "1", name: "Feed check" }]);
    expect(passedJobs("1")).toEqual([
      { id: "2", name: "Deploy to production" },
    ]);
  });
});
