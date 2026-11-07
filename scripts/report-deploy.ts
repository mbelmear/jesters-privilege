// Opens an issue when a run of Deploy fails in its production or feed check job,
// or adds to the one already open. The logic is src/lib/deploy-report.ts;
// scripts/failed-run.ts wires in `gh`. --dry-run prints the report for the newest
// such run of each job and writes nothing, which is how a pull request that
// changes this shows it working.
// Usage: npm run report-deploy -- <run-id> | --dry-run
import {
  DEPLOY_ISSUE_TITLE,
  DEPLOY_JOB,
  FEED_CHECK_ISSUE_TITLE,
  FEED_CHECK_JOB,
  deployReport,
  feedCheckReport,
} from "@/lib/deploy-report";
import { failedJobs, fileReport, gh, jobLogs, runUrl } from "./failed-run";

const REPORTED_JOBS = [
  { job: DEPLOY_JOB, title: DEPLOY_ISSUE_TITLE, report: deployReport },
  {
    job: FEED_CHECK_JOB,
    title: FEED_CHECK_ISSUE_TITLE,
    report: feedCheckReport,
  },
];

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
