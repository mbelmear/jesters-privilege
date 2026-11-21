import { execFileSync } from "node:child_process";
import {
  closeReport,
  failedJobs,
  failedRunsOnMain,
  fileReport,
  passedJobs,
} from "../../../scripts/failed-run";
import { fakeGh, madeUp, type GhAnswer, type GhCall } from "../../fake-gh";

// No test here can reach GitHub (tests/fake-gh.ts): the first version of this
// file, with a gh stub on Jest's PATH, opened real issues.
jest.mock("node:child_process", () => ({ execFileSync: jest.fn() }));

const TITLE = "Feed check is failing";
let calls: GhCall[] = [];
let openIssue = "";

function answer(args: readonly string[]): GhAnswer {
  const call = args.join(" ");
  // The --jq's shape: the open issue's number, or nothing.
  if (call.startsWith("issue list")) return madeUp(`${openIssue}\n`);
  // The --jq's shape, newest first.
  if (call.startsWith("run list")) return madeUp("30\n20\n");
  // The --jq's "<id>\t<name>" lines.
  if (call.includes('"failure"')) return madeUp("1\tFeed check\n");
  if (call.includes('"success"')) return madeUp("2\tDeploy to production\n");
  // The writes: the code ignores what gh prints.
  return madeUp("");
}

beforeEach(() => {
  openIssue = "";
  calls = fakeGh(execFileSync, answer);
});

const commands = () => calls.map((call) => call.command);
const writes = () =>
  commands().filter((call) => !call.startsWith("issue list"));

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

describe("failedRunsOnMain", () => {
  it("lists a workflow's failed runs on main, newest first", () => {
    expect(failedRunsOnMain("deploy.yml", { limit: 20 })).toEqual(["30", "20"]);
    expect(commands()).toEqual([
      "run list --workflow=deploy.yml --status=failure --branch=main --limit=20 --json=databaseId --jq=.[].databaseId",
    ]);
  });

  it("narrows to scheduled runs when asked", () => {
    failedRunsOnMain("nightly.yml", { limit: 1, event: "schedule" });
    expect(commands()).toEqual([
      "run list --workflow=nightly.yml --status=failure --branch=main --event=schedule --limit=1 --json=databaseId --jq=.[].databaseId",
    ]);
  });
});
