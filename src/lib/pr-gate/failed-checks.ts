// Why a PR's checks failed, printed once every check has finished. A failed
// job's link says only that it failed; its log says why (#193 took five calls
// to find a missing library without it). Whether main's head fails the same
// check says whose failure it likely is: if main does too, CI itself is likely
// broken rather than the PR (#200; #196's runner image failed every PR at once).
import type { Check, GitHub } from "./github";

/** Whether the checks failed: any failed, or was cancelled, which gh alone counts as passing. */
export const anyFailed = (checks: readonly Check[]) =>
  checks.some((check) => check.state === "fail" || check.state === "cancel");

/** The report's lines, for stderr. */
export function failedCheckReport(
  checks: readonly Check[],
  github: GitHub
): string[] {
  const cancelled = checks.filter((check) => check.state === "cancel");
  const fails = checks.filter((check) => check.state === "fail");
  return [
    ...cancelled.map(
      (check) =>
        `${check.name} was cancelled. Rerun it from its run: ${check.link}`
    ),
    ...fails.flatMap((check) => jobErrors(check, github)),
    ...fails.map((check) => `${check.name}: ${onMain(check.name, github)}`),
  ];
}

// https://github.com/<owner>/<repo>/actions/runs/<run>/job/<job>
const JOB_LINK =
  /^https:\/\/github\.com\/([^/]+\/[^/]+)\/actions\/runs\/\d+\/job\/(\d+)/;

/** The job's log from its first error on: the jobs API serves a finished job's log while the rest of its run goes on. */
function jobErrors({ name, link }: Check, github: GitHub): string[] {
  const job = JOB_LINK.exec(link);
  if (!job) return [];
  let log: string;
  try {
    log = github.jobLog(job[1] ?? "", job[2] ?? "");
  } catch {
    return [`Couldn't read ${name}'s log: ${link}`];
  }
  // Without the colours and the timestamps the runner adds.
  const lines = log
    .replace(/\u001b\[[0-9;]*m/g, "")
    .split("\n")
    .map((line) => line.replace(/^[0-9T:.-]+Z /, ""));
  const first = lines.findIndex((line) => line.includes("##[error]"));
  if (first === -1) {
    return [`${name} failed, with no ##[error] line in its log: ${link}`];
  }
  const errors = lines.slice(first, first + 20);
  // A log ends in a newline, which isn't a line of its own.
  while (errors.at(-1) === "") errors.pop();
  return [`${name} failed:`, ...errors];
}

function onMain(name: string, github: GitHub): string {
  let main: string;
  try {
    main = github.mainCheck(name);
  } catch {
    return "couldn't read main's run of it.";
  }
  // An empty answer says nothing about main's run either.
  if (!main) return "couldn't read main's run of it.";
  switch (main) {
    case "failure":
      return "main's head fails it too, so the cause is likely CI, not this PR.";
    case "success":
      return "main's head passes it.";
    case "pending":
      return "main's head is still running it.";
    case "none":
      return "main's head hasn't run it.";
    default:
      return `main's head ended it as ${main}.`;
  }
}
