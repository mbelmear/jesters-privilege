import {
  fakeGh,
  madeUp,
  recorded,
  type GhAnswer,
  type GhCall,
} from "../../fake-gh";

// No test here can reach GitHub (tests/fake-gh.ts). Recorded answers are from
// gh 2.103.3.
jest.mock("node:child_process", () => ({ execFileSync: jest.fn() }));

type Jobs = { failure?: string[]; success?: string[] };

let failedDeployRuns: string[];
let jobsByRun: Record<string, Jobs>;
let openIssues: Record<string, string>;
let calls: GhCall[];

// The --jq's "<id>\t<name>" lines. Only logs read the id, so each job's is its
// place in the list.
const jobLines = (names: readonly string[] = []) =>
  madeUp(names.map((name, i) => `${i + 1}\t${name}\n`).join(""));

// The error lines of a failed feed check's log (run 41899722981).
const JOB_LOG = [
  "2026-11-04T19:44:52.3422342Z ##[error]Feed check failed, so the live site stays as it is: Build manifest is missing episodeListenLinks",
  "2026-11-04T19:44:52.3670388Z ##[error]Process completed with exit code 1.",
].join("\n");
const FAILURE =
  "- Feed check failed, so the live site stays as it is: Build manifest is missing episodeListenLinks";
const RUN_URL = "https://github.com/mbelmear/jesters-privilege/actions/runs/";

function answer(args: readonly string[]): GhAnswer {
  const call = args.join(" ");
  if (call.startsWith("run list --workflow=deploy.yml")) {
    // The shape --jq=.[].databaseId gives.
    return madeUp(failedDeployRuns.map((id) => `${id}\n`).join(""));
  }
  const runJobs = /actions\/runs\/(\d+)\/jobs/.exec(call);
  if (runJobs) {
    const jobs = jobsByRun[runJobs[1] ?? ""] ?? {};
    return jobLines(call.includes('"failure"') ? jobs.failure : jobs.success);
  }
  if (call.includes("/logs")) return recorded("2026-11-21", JOB_LOG);
  const view = /^run view (\d+)/.exec(call);
  // Run 41899722981's URL, with the run's id swapped in.
  if (view) return recorded("2026-11-21", `${RUN_URL}${view[1]}\n`);
  if (call.startsWith("issue list")) {
    // The --jq's shape: an issue's number, or nothing.
    const title = /--search=(.+) in:title/.exec(call)?.[1] ?? "";
    return madeUp(`${openIssues[title] ?? ""}\n`);
  }
  // The writes: what they print, the script ignores.
  return madeUp("");
}

const writes = () =>
  calls
    .map((call) => call.command)
    .filter((call) => /^issue (create|comment|close)/.test(call));

// The script reports as it loads, so each run loads it afresh, with a fresh
// fake gh behind it.
async function reportDeploy(...args: string[]) {
  process.argv = ["node", "report-deploy.ts", ...args];
  jest.resetModules();
  const { execFileSync } = await import("node:child_process");
  calls = fakeGh(execFileSync, answer);
  await import("../../../scripts/report-deploy");
}

const argv = process.argv;
let log: jest.SpyInstance;
beforeEach(() => {
  failedDeployRuns = [];
  jobsByRun = {};
  openIssues = {};
  calls = [];
  log = jest.spyOn(console, "log").mockImplementation();
});
afterEach(() => {
  process.argv = argv;
  log.mockRestore();
});

describe("report-deploy <run-id>", () => {
  it("opens an issue for a failed production job", async () => {
    jobsByRun["9"] = { failure: ["Deploy to production"] };

    await reportDeploy("9");

    expect(writes()).toEqual([
      expect.stringContaining(
        `issue create --title=Production deploy is failing --body=The production deploy failed: ${RUN_URL}9\n\n${FAILURE}\n\n`
      ),
    ]);
  });

  it("adds a failed feed check to the issue still open", async () => {
    jobsByRun["9"] = { failure: ["Feed check"] };
    openIssues["Feed check is failing"] = "7";

    await reportDeploy("9");

    expect(writes()).toEqual([
      expect.stringContaining(
        `issue comment 7 --body=The feed check failed: ${RUN_URL}9\n\n${FAILURE}\n\n`
      ),
    ]);
  });

  it("reports each failed job in its own issue when both fail", async () => {
    jobsByRun["9"] = { failure: ["Deploy to production", "Feed check"] };

    await reportDeploy("9");

    expect(writes()).toEqual([
      expect.stringMatching(
        /^issue create --title=Production deploy is failing /
      ),
      expect.stringMatching(/^issue create --title=Feed check is failing /),
    ]);
  });

  it("closes the feed check's issue once a feed check passes", async () => {
    jobsByRun["9"] = { success: ["Deploy to production", "Feed check"] };
    openIssues["Feed check is failing"] = "7";
    openIssues["Production deploy is failing"] = "8";

    await reportDeploy("9");

    expect(writes()).toEqual([
      `issue close 7 --comment=A feed check passed: ${RUN_URL}9`,
    ]);
  });

  it("leaves the feed check's issue open when only the deploy passed", async () => {
    jobsByRun["9"] = { success: ["Deploy to production"] };
    openIssues["Feed check is failing"] = "7";

    await reportDeploy("9");

    expect(writes()).toEqual([]);
  });
});

describe("report-deploy --dry-run", () => {
  it("prints the report for the newest failed run of each job, writing nothing", async () => {
    failedDeployRuns = ["30", "20", "10"];
    jobsByRun["30"] = { failure: ["Lint"], success: ["Feed check"] };
    jobsByRun["20"] = { failure: ["Feed check"] };
    jobsByRun["10"] = { failure: ["Deploy to production"] };

    await reportDeploy("--dry-run");

    expect(writes()).toEqual([]);
    const printed = log.mock.calls.flat().join("\n");
    expect(printed).toContain(`The production deploy failed: ${RUN_URL}10`);
    expect(printed).toContain(`The feed check failed: ${RUN_URL}20`);
  });

  it("says so when no run failed in a job", async () => {
    await reportDeploy("--dry-run");

    expect(writes()).toEqual([]);
    expect(log).toHaveBeenCalledWith(
      'No failed "Deploy to production" job to report.'
    );
    expect(log).toHaveBeenCalledWith('No failed "Feed check" job to report.');
  });
});
