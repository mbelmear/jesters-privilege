// Opens an issue for a failed scheduled Nightly, or adds to the one already
// open. The logic is src/lib/nightly-report.ts; scripts/failed-run.ts wires in `gh`.
// --dry-run prints the report for the newest failed Nightly and writes nothing,
// which is how a pull request that changes this shows it working. With
// --failed-job (repeatable), it prints the report for those jobs instead, asking
// GitHub nothing: the newest failure only shows the advice its own jobs earn.
// Usage: npm run report-nightly -- <run-id> | --dry-run [--failed-job <name>]...
import { NIGHTLY_ISSUE_TITLE, nightlyReport } from "@/lib/nightly-report";
import { failedJobs, fileReport, gh, jobLogs, runUrl } from "./failed-run";

const argument = process.argv[2];
if (!argument) {
  throw new Error("Usage: npm run report-nightly -- <run-id> | --dry-run");
}
const dryRun = argument === "--dry-run";

const jobFlags = process.argv.slice(3);
if (dryRun && jobFlags.length) {
  const names = jobFlags.flatMap((flag, i) =>
    i % 2 === 0 && flag === "--failed-job" ? [jobFlags[i + 1] ?? ""] : []
  );
  if (names.length * 2 !== jobFlags.length || names.includes("")) {
    console.error("Usage: --dry-run [--failed-job <name>]...");
    process.exit(1);
  }
  console.log(nightlyReport("(the run's link)", "", names));
  process.exit(0);
}

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

const failed = failedJobs(runId);
fileReport(
  NIGHTLY_ISSUE_TITLE,
  nightlyReport(
    runUrl(runId),
    jobLogs(failed),
    failed.map((job) => job.name)
  ),
  dryRun
);
