// The PR gate's GitHub (src/lib/pr-gate/github.ts), built from `gh`.
import {
  CHECK_STATES,
  Disconnected,
  PR_STATES,
  type Check,
  type CheckState,
  type GitHub,
  type PrState,
} from "@/lib/pr-gate/github";
import { gh, ghQuiet } from "./failed-run";

// What gh prints when it can't reach GitHub, rather than GitHub answering.
const DROPPED = /error connecting to|dial tcp|connection reset|timeout|EOF/;

// What execFileSync's error kept of gh's output.
const printed = (error: unknown, stream: "stdout" | "stderr") =>
  error instanceof Error && stream in error
    ? String(Reflect.get(error, stream) ?? "")
    : "";

const isCheckState = (bucket: string): bucket is CheckState =>
  CHECK_STATES.some((state) => state === bucket);
const isPrState = (state: string): state is PrState =>
  PR_STATES.some((known) => known === state);

const tabbed = (output: string) =>
  output
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"));

export const ghGitHub: GitHub = {
  pullRequest(pr) {
    const [state = "", branch = "", head = ""] =
      tabbed(
        gh(
          "pr",
          "view",
          String(pr),
          "--json=state,headRefName,headRefOid",
          "--jq=[.state, .headRefName, .headRefOid] | @tsv"
        )
      )[0] ?? [];
    if (!isPrState(state)) {
      throw new Error(`gh pr view gave #${pr} an unknown state: ${state}`);
    }
    return { state, branch, head };
  },

  checks(pr) {
    let rows: string;
    try {
      rows = ghQuiet(
        "pr",
        "checks",
        String(pr),
        "--json=name,bucket,link",
        "--jq=.[] | [.name, .bucket, .link] | @tsv"
      );
    } catch (error) {
      const stderr = printed(error, "stderr");
      if (DROPPED.test(stderr)) throw new Disconnected(stderr.trim());
      if (stderr.includes("no checks reported")) return [];
      // gh exits 8 while any is pending and 1 once any failed, having printed them.
      rows = printed(error, "stdout");
      if (!rows.trim()) throw error;
    }
    return tabbed(rows).map(([name = "", bucket = "", link = ""]): Check => {
      if (!isCheckState(bucket)) {
        throw new Error(
          `gh pr checks gave ${name} an unknown state: ${bucket}`
        );
      }
      return { name, state: bucket, link };
    });
  },

  comments(pr) {
    const json: unknown = JSON.parse(
      ghQuiet(
        "pr",
        "view",
        String(pr),
        "--json=comments",
        "--jq=[.comments[].body]"
      )
    );
    const bodies: unknown[] = Array.isArray(json) ? json : [];
    return bodies.filter((body): body is string => typeof body === "string");
  },

  jobLog(repo, job) {
    return ghQuiet(
      "api",
      "--allow-escape-sequences",
      `repos/${repo}/actions/jobs/${job}/logs`
    );
  },

  mainCheck(name) {
    return ghQuiet(
      "api",
      "-X",
      "GET",
      "repos/{owner}/{repo}/commits/main/check-runs",
      "-f",
      `check_name=${name}`,
      `--jq=if (.check_runs | length) == 0 then "none" else .check_runs | max_by(.started_at) | .conclusion // "pending" end`
    ).trim();
  },
};
