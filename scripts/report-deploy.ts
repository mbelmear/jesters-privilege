// Opens an issue when a run of Deploy fails in its production or feed check job,
// or adds to the one already open, and closes the feed check's once one passes.
// The logic is src/lib/deploy-report.ts;
// scripts/failed-run.ts wires in `gh`. --dry-run prints the report for the newest
// such run of each job and writes nothing, which is how a pull request that
// changes this shows it working.
// Usage: npm run report-deploy -- <run-id> | --dry-run
import {
  FEED_CHECK_ISSUE_TITLE,
  FEED_CHECK_JOB,
  REPORTED_JOBS,
  feedCheckPassed,
} from "@/lib/deploy-report";
import {
  closeReport,
  failedJobs,
  fileReport,
  gh,
  jobLogs,
  passedJobs,
  runUrl,
} from "./failed-run";

const argument = process.argv[2];
if (!argument) {
  throw new Error("Usage: npm run report-deploy -- <run-id> | --dry-run");
}
const dryRun = argument === "--dry-run";

const failedRuns = () =>
  gh(
    "run",
    "list",
    "--workflow=deploy.yml",
    "--status=failure",
    "--branch=main",
    "--limit=20",
    "--json=databaseId",
    "--jq=.[].databaseId"
  )
    .split("\n")
    .filter(Boolean);

const failedIn = (runId: string, job: string) =>
  failedJobs(runId).filter((failed) => failed.name === job);

for (const { job, title, report } of REPORTED_JOBS) {
  const runId = dryRun
    ? failedRuns().find((id) => failedIn(id, job).length > 0)
    : argument;
  const jobs = runId ? failedIn(runId, job) : [];
  if (!runId || jobs.length === 0) {
    console.log(`No failed "${job}" job to report.`);
    continue;
  }
  fileReport(title, report(runUrl(runId), jobLogs(jobs)), dryRun);
}

if (!dryRun && passedJobs(argument).some((j) => j.name === FEED_CHECK_JOB)) {
  closeReport(FEED_CHECK_ISSUE_TITLE, feedCheckPassed(runUrl(argument)));
}
