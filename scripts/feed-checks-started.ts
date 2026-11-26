// The backstop on Deploy's schedule (ADR 0004): fails the scheduled feed check
// when the Worker hasn't started one in the last 3 hours, so an expired token
// or a dead Cron Trigger opens "Feed check is failing". The logic is
// `checkFeedChecksStarted` (src/lib/feed-check-start.ts); this wires in gh.
// Usage: npm run feed-checks-started (run by .github/workflows/deploy.yml)
import { errorMessage } from "@/lib/download";
import { checkFeedChecksStarted } from "@/lib/feed-check-start";
import { ghQuiet } from "./failed-run";

try {
  const runs = ghQuiet(
    "run",
    "list",
    "--workflow=deploy.yml",
    "--event=workflow_dispatch",
    "--branch=main",
    "--limit=20",
    "--json=createdAt,displayTitle"
  );
  process.exitCode = checkFeedChecksStarted(runs, new Date(), (line) =>
    console.log(line)
  );
} catch (error: unknown) {
  // An ::error:: is what the Deploy report names in its issue.
  console.log(
    `::error::Couldn't tell whether the Worker is starting feed checks: ${errorMessage(error)}`
  );
  process.exitCode = 1;
}
