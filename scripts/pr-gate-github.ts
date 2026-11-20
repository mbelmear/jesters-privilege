// The PR gate's GitHub (src/lib/pr-gate/github.ts), built from `gh`.
import {
  CHECK_STATES,
  Disconnected,
  PR_STATES,
  type Check,
  type CheckState,
  type GitHub,
  type PrContents,
  type PrState,
} from "@/lib/pr-gate/github";
import { gh, ghLoud, ghQuiet } from "./failed-run";

// What gh prints when it can't reach GitHub, rather than GitHub answering.
const DROPPED = /error connecting to|dial tcp|connection reset|timeout|EOF/;

// What execFileSync's error kept of gh's output.
const printed = (error: unknown, stream: "stdout" | "stderr") =>
  error instanceof Error && stream in error
    ? String(Reflect.get(error, stream) ?? "")
    : "";

/** A quiet read's error, saying gh's own error, which it kept from printing. */
const quietError = (command: string, error: unknown) =>
  new Error(
    `${command}: ${printed(error, "stderr").trim() || (error instanceof Error ? error.message : "")}`,
    { cause: error }
  );

const isCheckState = (bucket: string): bucket is CheckState =>
  CHECK_STATES.some((state) => state === bucket);
const isPrState = (state: string): state is PrState =>
  PR_STATES.some((known) => known === state);

const tabbed = (output: string) =>
  output
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"));

// Reads gh's JSON field by field, throwing on a shape it doesn't know: a
// check that read nothing would pass a PR it should refuse.
type Json = Record<string, unknown>;
const isJson = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function field<T>(
  json: unknown,
  key: string,
  is: (value: unknown) => value is T
): T {
  const value = isJson(json) ? json[key] : undefined;
  if (!is(value)) {
    throw new Error(`gh pr view gave ${key} as ${JSON.stringify(value)}`);
  }
  return value;
}

const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number => typeof value === "number";
const isList = (value: unknown): value is unknown[] => Array.isArray(value);
const isBody = (value: unknown): value is string | null =>
  value === null || isString(value);

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
      if (!rows.trim()) throw quietError(`gh pr checks ${pr}`, error);
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

  contents(pr): PrContents {
    const read: unknown = JSON.parse(
      gh(
        "pr",
        "view",
        String(pr),
        "--json=title,body,closingIssuesReferences,commits,files"
      )
    );
    return {
      title: field(read, "title", isString),
      body: field(read, "body", isBody) ?? "",
      closingIssues: field(read, "closingIssuesReferences", isList).map(
        (issue) => field(issue, "number", isNumber)
      ),
      // gh splits a message at its first line, dropping the blank line after
      // it, and cuts a long first line with "…", which then also opens the
      // body; rejoined, a keyword cut in two reads whole.
      commitMessages: field(read, "commits", isList).map((commit) =>
        `${field(commit, "messageHeadline", isString)}\n${field(commit, "messageBody", isString)}`.replace(
          "…\n…",
          ""
        )
      ),
      files: field(read, "files", isList).map((file) =>
        field(file, "path", isString)
      ),
    };
  },

  comment(pr, body) {
    ghLoud("pr", "comment", String(pr), `--body=${body}`);
  },

  addLabel(pr, label) {
    ghLoud("pr", "edit", String(pr), `--add-label=${label}`);
  },

  comments(pr) {
    let read: string;
    try {
      read = ghQuiet(
        "pr",
        "view",
        String(pr),
        "--json=comments",
        "--jq=[.comments[].body]"
      );
    } catch (error) {
      throw quietError(`gh pr view ${pr} --json=comments`, error);
    }
    const json: unknown = JSON.parse(read);
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
