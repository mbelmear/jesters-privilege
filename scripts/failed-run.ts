// The `gh` wiring a failed run's report shares: which jobs failed, their logs,
// and the one open issue that tracks it. Used by report-nightly and report-deploy.
import { execFileSync } from "node:child_process";

export const gh = (...args: string[]) =>
  execFileSync("gh", args, { encoding: "utf8", maxBuffer: 1 << 28 });

export type FailedJob = { readonly id: string; readonly name: string };

export function failedJobs(runId: string): FailedJob[] {
  return gh(
    "api",
    "--paginate",
    `repos/{owner}/{repo}/actions/runs/${runId}/jobs`,
    '--jq=.jobs[] | select(.conclusion == "failure") | "\\(.id)\\t\\(.name)"'
  )
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [id = "", name = ""] = line.split("\t");
      return { id, name };
    });
}

// Logs job by job: a report can run inside the failed run, and `gh run view
// --log-failed` refuses a run still in progress. A report without names still
// beats no report, so unreadable logs don't stop it.
export function jobLogs(jobs: readonly FailedJob[]): string {
  try {
    return jobs
      .map((job) =>
        gh(
          "api",
          "--allow-escape-sequences",
          `repos/{owner}/{repo}/actions/jobs/${job.id}/logs`
        )
      )
      .join("\n");
  } catch (error: unknown) {
    console.log(
      `::warning::Can't read the failed jobs' logs: ${String(error)}`
    );
    return "";
  }
}

export function runUrl(runId: string): string {
  return gh("run", "view", runId, "--json=url", "--jq=.url").trim();
}

/** Opens an issue with this title, or adds to the one already open. */
export function fileReport(title: string, report: string, dryRun: boolean) {
  // The search matches loosely, so the title is checked exactly.
  const open = gh(
    "issue",
    "list",
    "--state=open",
    `--search=${title} in:title`,
    "--json=number,title",
    `--jq=map(select(.title == "${title}"))[0].number // empty`
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
      `--title=${title}`,
      `--body=${report}`,
      "--label=needs-triage"
    );
  }
}
