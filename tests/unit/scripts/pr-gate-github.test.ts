import { execFileSync } from "node:child_process";
import { Disconnected } from "@/lib/pr-gate/github";
import { ghGitHub } from "../../../scripts/pr-gate-github";

// Fakes the process call itself, so no test here can reach GitHub (#164): see
// failed-run.test.ts. Each answer says whether gh printed it (gh 2.103.3,
// 2026-11-20) or it is made up in the shape gh's --jq gives.
jest.mock("node:child_process", () => ({ execFileSync: jest.fn() }));

const calls: string[][] = [];
const quiet: boolean[] = [];
let answer: (args: readonly string[]) => string = () => "";

beforeEach(() => {
  calls.length = 0;
  quiet.length = 0;
  jest.mocked(execFileSync).mockImplementation(((
    _file: string,
    args: readonly string[],
    options?: { stdio?: unknown }
  ) => {
    calls.push([...args]);
    quiet.push(options?.stdio !== undefined);
    return answer(args);
  }) as typeof execFileSync);
});

// What execFileSync throws when gh exits non-zero: its message names the
// command, then adds stderr if there was any (Node 24.22.1, 2026-11-20).
const exited = (status: number, stderr: string, stdout = "") =>
  Object.assign(
    new Error(`Command failed: gh pr checks${stderr ? `\n${stderr}` : ""}`),
    {
      status,
      stderr,
      stdout,
    }
  );

describe("the gh GitHub", () => {
  it("reads a PR's state, branch and head in one call", () => {
    // Recorded: PR #256 (its state then MERGED).
    answer = () =>
      "OPEN\tepisode-visit\t5c8068b2027589f957bc1f5a201e182b30c90038\n";

    expect(ghGitHub.pullRequest(256)).toEqual({
      state: "OPEN",
      branch: "episode-visit",
      head: "5c8068b2027589f957bc1f5a201e182b30c90038",
    });
    expect(calls).toEqual([
      [
        "pr",
        "view",
        "256",
        "--json=state,headRefName,headRefOid",
        "--jq=[.state, .headRefName, .headRefOid] | @tsv",
      ],
    ]);
  });

  describe("checks", () => {
    // Recorded: PR #256, cut to two rows.
    const SAMPLE =
      "Playwright (Chromium, WebKit)\tpass\thttps://github.com/mbelmear/jesters-privilege/actions/runs/44780476936/job/136442437798\nPreview URL\tskipping\t\n";

    it("reads each check's name, bucket and link", () => {
      answer = () => SAMPLE;

      expect(ghGitHub.checks(256)).toEqual([
        {
          name: "Playwright (Chromium, WebKit)",
          state: "pass",
          link: "https://github.com/mbelmear/jesters-privilege/actions/runs/44780476936/job/136442437798",
        },
        { name: "Preview URL", state: "skipping", link: "" },
      ]);
      expect(calls).toEqual([
        [
          "pr",
          "checks",
          "256",
          "--json=name,bucket,link",
          "--jq=.[] | [.name, .bucket, .link] | @tsv",
        ],
      ]);
    });

    it("reads them when gh exits as pending or failed", () => {
      // Made up: the exit code; the rows are SAMPLE's.
      answer = () => {
        throw exited(8, "", SAMPLE);
      };

      expect(ghGitHub.checks(256)).toHaveLength(2);
    });

    it("are none before CI starts", () => {
      // Made up: no PR here has run without checks to record. gh's wording, as
      // read-checks.test.ts has it.
      answer = () => {
        throw exited(1, "no checks reported on the 'ticket' branch\n");
      };

      expect(ghGitHub.checks(256)).toEqual([]);
    });

    // Made up: one error per pattern read-checks.sh has retried on.
    it.each([
      "error connecting to api.github.com",
      'Post "https://api.github.com/graphql": dial tcp: lookup api.github.com: no such host',
      "read: connection reset by peer",
      "net/http: TLS handshake timeout",
      "unexpected EOF",
    ])("say a dropped connection apart: %s", (stderr) => {
      answer = () => {
        throw exited(1, `${stderr}\n`);
      };

      expect(() => ghGitHub.checks(256)).toThrow(Disconnected);
    });

    it("say gh's error, or its own when gh printed none", () => {
      // Made up.
      answer = () => {
        throw exited(1, "");
      };

      expect(() => ghGitHub.checks(256)).toThrow(
        "gh pr checks 256: Command failed: gh pr checks"
      );
    });

    it("pass any other error on", () => {
      // Recorded: gh pr checks 99999.
      answer = () => {
        throw exited(
          1,
          "GraphQL: Could not resolve to a PullRequest with the number of 99999.\n"
        );
      };

      // gh's error is kept from printing, so the error thrown says it.
      expect(() => ghGitHub.checks(99999)).toThrow(
        "gh pr checks 99999: GraphQL: Could not resolve to a PullRequest with the number of 99999."
      );
    });
  });

  it("reads each comment's body", () => {
    // Made up.
    answer = () => '["Looks good","<!-- deploy-preview -->\\nBuilt from a."]\n';

    expect(ghGitHub.comments(256)).toEqual([
      "Looks good",
      "<!-- deploy-preview -->\nBuilt from a.",
    ]);
    expect(calls).toEqual([
      ["pr", "view", "256", "--json=comments", "--jq=[.comments[].body]"],
    ]);
  });

  it("reads a job's log through the jobs API", () => {
    // Made up.
    answer = () => "##[error]the cause\n";

    expect(ghGitHub.jobLog("o/r", "42")).toBe("##[error]the cause\n");
    expect(calls).toEqual([
      ["api", "--allow-escape-sequences", "repos/o/r/actions/jobs/42/logs"],
    ]);
  });

  it("reads how main's head last ran a check", () => {
    // Made up.
    answer = () => "failure\n";

    expect(ghGitHub.mainCheck("Lint workflows")).toBe("failure");
    expect(calls).toEqual([
      [
        "api",
        "-X",
        "GET",
        "repos/{owner}/{repo}/commits/main/check-runs",
        "-f",
        "check_name=Lint workflows",
        `--jq=if (.check_runs | length) == 0 then "none" else .check_runs | max_by(.started_at) | .conclusion // "pending" end`,
      ],
    ]);
  });

  it("refuses a PR state it doesn't know", () => {
    // Made up: gh has no such state.
    answer = () => "DRAFTED\tticket\tabc\n";

    expect(() => ghGitHub.pullRequest(256)).toThrow(
      "gh pr view gave #256 an unknown state: DRAFTED"
    );
  });

  // A poll reads again on an error, so gh's own errors would print at each try.
  it("keeps gh's errors to itself on reads that are polled or reported on", () => {
    // Made up: empty answers, read only for how gh was called.
    answer = (args) => (args.includes("--json=comments") ? "[]" : "");
    ghGitHub.checks(256);
    ghGitHub.comments(256);
    ghGitHub.jobLog("o/r", "42");
    ghGitHub.mainCheck("Build");

    expect(quiet).toEqual([true, true, true, true]);
  });

  // Its errors carry gh's own message, which the command prints on its way out.
  it("lets gh print its errors on the read that ends a command", () => {
    // Made up.
    answer = () => "OPEN\tticket\tabc\n";
    ghGitHub.pullRequest(256);

    expect(quiet).toEqual([false]);
  });
});
