# The feed check is started by a Cloudflare Cron Trigger

ADR 0001's feed check ran on GitHub's schedule, which GitHub delays and drops under load and promises no rate for: asking for 12 runs a day, it ran 3 to 4 a day from 2026-11-12 to 11-21 and about 2 a day, 7 to 12 hours apart, from 11-22 to 11-26 (#298, #302), so on release day a new Episode could wait half a day unless a Jester pressed **Run workflow**. So the site Worker (`jesters-privilege`) also has a Cron Trigger that runs hourly and starts Deploy through GitHub's workflow-dispatch API, with an input that makes the run check the feed first, exactly as a scheduled run does; the **Run workflow** button leaves the input off and still deploys whatever the feed holds. When that check finds a new newest Episode and deploys it, Deploy starts Transcribe, marked as not the button's, so Transcribe still refuses an Episode older than a week. The Worker holds a fine-grained personal access token limited to this repo's **Actions: write**, expiring after 366 days and renewed on a dated ticket; it is a `production` environment secret that each production deploy uploads, as Turnstile's is. GitHub's schedules stay as a backstop: Deploy's still checks the feed, and also fails, opening "Feed check is failing", when no Worker-started check has run in the last 3 hours, so an expired token or a broken cron is loud instead of only slow; Transcribe's still retries Transcripts a failed run missed.

## Considered Options

- **A Spreaker publish webhook**: Spreaker has none (its developer docs, checked 2026-11-26).
- **More `cron` lines on GitHub**: GitHub drops runs whatever the schedule asks for.
- **An outside cron service**: a third party would hold a token to the repo.
- **A `repository_dispatch` event**: keeps the Worker's runs apart in Actions, but needs **Contents: write**, which could also push to the `transcripts` branch.
- **The Worker compares the feed with `/build-manifest.json` itself**: fewer Actions runs, but the check's logic would live in two places, and its Transcript and Episode Listen link checks need the apps' lookups, which don't fit a free-plan Cron Trigger's 10 ms of CPU.
- **A separate Worker for the cron**: keeps the token away from the site's code, but adds a second Worker to deploy and watch for something that changes about once a year.
- **A GitHub App instead of a personal access token**: never expires, but the Worker would have to sign a JWT and exchange it for an installation token.
- **Every 30 minutes**: an outage would add 48 comments a day to "Feed check is failing"; hourly gets an Episode live within about 1¼ hours.
