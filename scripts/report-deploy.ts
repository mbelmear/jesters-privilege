// Opens an issue when a run of Deploy fails in its production job, or adds to
// the one already open. The logic is src/lib/deploy-report.ts; scripts/failed-run.ts
// wires in `gh`. --dry-run prints the report for the newest such run and writes
// nothing, which is how a pull request that changes this shows it working.
// Usage: npm run report-deploy -- <run-id> | --dry-run
import {
  DEPLOY_ISSUE_TITLE,
  DEPLOY_JOB,
  deployReport,
} from "@/lib/deploy-report";
import { failedJobs, fileReport, gh, jobLogs, runUrl } from "./failed-run";

const argument = process.argv[2];
if (!argument) {
  throw new Error("Usage: npm run report-deploy -- <run-id> | --dry-run");
}
const dryRun = argument === "--dry-run";

const failedDeploy = (runId: string) =>
  failedJobs(runId).filter((job) => job.name === DEPLOY_JOB);

const runId = dryRun
  ? gh(
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
      .filter(Boolean)
      .find((id) => failedDeploy(id).length > 0)
  : argument;

const jobs = runId ? failedDeploy(runId) : [];
if (!runId || jobs.length === 0) {
  console.log("No failed production deploy to report.");
  process.exit(0);
}

fileReport(
  DEPLOY_ISSUE_TITLE,
  deployReport(runUrl(runId), jobLogs(jobs)),
  dryRun
);
