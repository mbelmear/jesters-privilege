// Who starts the feed check (ADR 0004). The site Worker's hourly Cron Trigger
// asks GitHub to run Deploy with the feed check turned on (`startFeedCheck`),
// since GitHub runs Deploy's own schedule a few times a day, not 12. That
// schedule stays as a backstop and also checks the Worker is still starting
// them (`checkFeedChecksStarted`), so a dead token or cron fails loudly.
import type { Fetch } from "./download";

// Deploy's workflow_dispatch input that makes a run check the feed first, as
// a scheduled run does (.github/workflows/deploy.yml).
export const FEED_CHECK_INPUT = "feed-check";

// The run-name Deploy gives a run with that input on, which is how the
// backstop finds the Worker's runs (.github/workflows/deploy.yml, `run-name`).
export const FEED_CHECK_RUN_NAME = "Feed check started by the Worker";

const DISPATCHES =
  "https://api.github.com/repos/mbelmear/jesters-privilege/actions/workflows/deploy.yml/dispatches";

/**
 * Asks GitHub to run Deploy on main with the feed check on. Throws, naming
 * GitHub's answer, when the token is missing or GitHub refuses; the token
 * never appears in what it throws or logs.
 */
export async function startFeedCheck(
  token: string | undefined,
  fetch: Fetch,
  log: (line: string) => void
): Promise<void> {
  if (!token) {
    throw new Error(
      "DEPLOY_DISPATCH_TOKEN isn't set, so no feed check was started (docs/deploy.md, Credentials)"
    );
  }
  const response = await fetch(DISPATCHES, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      // GitHub's REST API refuses a request without one.
      "User-Agent": "jesters-privilege-worker",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      ref: "main",
      inputs: { [FEED_CHECK_INPUT]: "true" },
      return_run_details: true,
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `GitHub refused to start the feed check (${response.status}): ${field(text, "message") ?? text.slice(0, 200)}`
    );
  }
  const run = field(text, "html_url");
  log(`Started a feed check${run ? `: ${run}` : ""}`);
}

// A string field of a JSON object answer, or null when there's none.
function field(text: string, name: string): string | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || !(name in value)) {
    return null;
  }
  const found: unknown = Object.getOwnPropertyDescriptor(value, name)?.value;
  return typeof found === "string" ? found : null;
}

// How long the backstop lets pass without a run the Worker started: two
// missed hourly triggers, so one slow or dropped dispatch stays quiet.
const STARTED_WITHIN_HOURS = 3;

type DispatchedRun = { createdAt: string; displayTitle: string };

/**
 * The backstop on Deploy's schedule: from `gh run list --workflow deploy.yml
 * --event workflow_dispatch --json createdAt,displayTitle` (newest first),
 * passes (0) when the Worker started a feed check in the last 3 hours, and
 * fails (1) with an `::error::` otherwise. Throws when gh's list can't be read.
 */
export function checkFeedChecksStarted(
  ghRuns: string,
  now: Date,
  log: (line: string) => void
): number {
  const runs = parseRuns(ghRuns);
  const newest = runs
    .filter((run) => run.displayTitle === FEED_CHECK_RUN_NAME)
    .map((run) => run.createdAt)
    .sort()
    .at(-1);
  const since = now.getTime() - STARTED_WITHIN_HOURS * 60 * 60 * 1000;
  if (newest && Date.parse(newest) >= since) {
    log(
      `::notice::The Worker started a feed check at ${newest}, within the last ${STARTED_WITHIN_HOURS} hours`
    );
    return 0;
  }
  const found = newest
    ? `the newest was at ${newest}`
    : `none of the ${runs.length} newest dispatched Deploy runs is one`;
  log(
    `::error::No feed check started by the Worker has run in the last ${STARTED_WITHIN_HOURS} hours (${found}), so a new Episode waits for GitHub's schedule. Check the Worker's Cron Trigger and its DEPLOY_DISPATCH_TOKEN (docs/deploy.md, Triggers).`
  );
  return 1;
}

function parseRuns(text: string): DispatchedRun[] {
  const what = "gh's list of Deploy runs";
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`${what} isn't JSON`);
  }
  if (!Array.isArray(value)) throw new Error(`${what} isn't a list`);
  return value.map((run: unknown) => {
    if (
      typeof run !== "object" ||
      run === null ||
      !("createdAt" in run) ||
      !("displayTitle" in run) ||
      typeof run.createdAt !== "string" ||
      typeof run.displayTitle !== "string"
    ) {
      throw new Error(`${what} has a run without createdAt and displayTitle`);
    }
    if (Number.isNaN(Date.parse(run.createdAt))) {
      throw new Error(
        `${what} has a run created at ${JSON.stringify(run.createdAt)}, which isn't a date`
      );
    }
    return { createdAt: run.createdAt, displayTitle: run.displayTitle };
  });
}
