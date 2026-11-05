// Opens an issue for a failed scheduled Nightly, or adds to the one already
// open. The logic is src/lib/nightly-report.ts; this wires in `gh`.
// --dry-run prints the report for the newest failed Nightly and writes nothing,
// which is how a pull request that changes this shows it working.
// Usage: npm run report-nightly -- <run-id> | --dry-run
import { execFileSync } from "node:child_process";
import { NIGHTLY_ISSUE_TITLE, nightlyReport } from "@/lib/nightly-report";

const gh = (...args: string[]) =>
  execFileSync("gh", args, { encoding: "utf8", maxBuffer: 1 << 28 });

const argument = process.argv[2];
if (!argument) {
  throw new Error("Usage: npm run report-nightly -- <run-id> | --dry-run");
}
const dryRun = argument === "--dry-run";

const runId = dryRun
  ? gh(
      "run",
      "list",
      "--workflow=nightly.yml",
      "--status=failure",
      "--event=schedule",
      "--limit=1",
      "--json=databaseId",
      "--jq=.[0].databaseId"
    ).trim()
  : argument;
if (!runId) {
  console.log("No failed Nightly to report.");
  process.exit(0);
}

// Logs job by job: this runs inside the failed run, and `gh run view
// --log-failed` refuses a run still in progress.
const jobs = gh(
  "api",
  "--paginate",
  `repos/{owner}/{repo}/actions/runs/${runId}/jobs`,
  '--jq=.jobs[] | select(.conclusion == "failure") | .id'
)
  .split("\n")
  .filter(Boolean);
// A report without names still beats no report, so unreadable logs don't stop it.
let log = "";
try {
  log = jobs
    .map((job) =>
      gh(
        "api",
        "--allow-escape-sequences",
        `repos/{owner}/{repo}/actions/jobs/${job}/logs`
      )
    )
    .join("\n");
} catch (error: unknown) {
  console.log(`::warning::Can't read the failed jobs' logs: ${String(error)}`);
}
const report = nightlyReport(
  gh("run", "view", runId, "--json=url", "--jq=.url").trim(),
  log
);

// The search matches loosely, so the title is checked exactly.
const open = gh(
  "issue",
  "list",
  "--state=open",
  `--search=${NIGHTLY_ISSUE_TITLE} in:title`,
  "--json=number,title",
  `--jq=map(select(.title == "${NIGHTLY_ISSUE_TITLE}"))[0].number // empty`
).trim();

if (dryRun) {
  console.log(open ? `Would comment on #${open}:` : "Would open an issue:");
  console.log(report);
} else if (open) {
  gh("issue", "comment", open, `--body=${report}`);
} else {
  gh(
    "issue",
    "create",
    `--title=${NIGHTLY_ISSUE_TITLE}`,
    `--body=${report}`,
    "--label=needs-triage"
  );
}
