# Deploy

The site is one Cloudflare Worker (`jesters-privilege`) serving the static export in `out/` (ADR 0001). `.github/workflows/deploy.yml` builds and deploys it with `wrangler`; the Worker's config is `wrangler.jsonc`.

## Triggers

| Trigger                                    | What happens                                                                                                                                                                                                               |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Push to `main`                             | Build, `wrangler deploy` to production, then `scripts/smoke-check.sh`                                                                                                                                                      |
| **Run workflow** button (Actions → Deploy) | The same as a push to `main`                                                                                                                                                                                               |
| Pull request                               | Build, `wrangler versions upload --preview-alias pr-<n>`, then post the preview URL as a PR comment, updated on each push. Skipped for Dependabot's and forks' pull requests, which GitHub runs without the repo's secrets |
| Every 2 hours (feed check)                 | `npm run feed-check`; only when the feed's newest Episode isn't on the live site, or an Episode has gained an Episode Listen link or a Transcript since, the same as a push to `main`                                      |

The feed check (`scripts/feed-check.ts`, logic in `src/lib/feed-check.ts`) reads the feed exactly as the build does and compares its newest Episode's GUID with `newestEpisodeGuid` in the live `/build-manifest.json`, then looks the Episodes up in the apps as the build does and compares the Episodes each app lists with `episodeListenLinks`, then reads the Episodes' Transcripts as the build does and compares the Episodes that have one with `transcripts`. It takes about a minute, most of it installing dependencies, and sets the job output `rebuild`:

- **Same Episode, no new Episode Listen links or Transcripts**: `rebuild=false`, and the deploy job is skipped.
- **An Episode has gained an Episode Listen link**: `rebuild=true`, and the deploy job ships it, so a new Episode's Apple Podcasts and Spotify links arrive on their own within a feed check or two of each app listing it. An Episode that lost one, as when an app's lookup fails, doesn't rebuild; a failed lookup logs a `::warning::` naming the app and why.
- **An Episode has gained a Transcript**: `rebuild=true`, as when the Transcribe workflow has saved one (Transcripts, below). An Episode whose Transcript can't be had this time doesn't rebuild; a `::warning::` names it and why. A new Episode gets one too, until Transcribe reaches it.
- **Different Episode**: `rebuild=true`, and the deploy job builds and ships as for a push. The next check finds the new Episode live and stands down, so one new Episode makes one deploy (two, if the build is handed a stale cached copy of the feed; the next check then catches up).
- **Feed can't be read or breaks a rule, or the live manifest is missing, unreachable, or not valid**: the job fails with an `::error::` naming why, nothing deploys, and the live site stays as it is. A manifest the check can't read doesn't trigger a rebuild, which could repeat every 2 hours unnoticed; once the cause is fixed, the **Run workflow** button redeploys.

Release day doesn't wait for the schedule: the **Run workflow** button deploys whatever the feed holds. GitHub may start a scheduled run some minutes late, and it disables schedules in a public repo after 60 days without a commit; Actions → Deploy shows a banner with a button to turn it back on. A failed scheduled run emails whoever last changed the `cron` line.

Wrangler can't upload a preview version to a Worker that doesn't exist yet. If no Worker exists, the preview job first creates it with a blank placeholder page on workers.dev, with no custom domains. That happens once, before the first production deploy.

If the build fails, the workflow stops before `wrangler deploy`, so the last good deploy stays live. A failed run emails the repo owner through GitHub's default Actions notifications, and a failed **Deploy to production** job also opens an issue titled "Production deploy is failing", or comments on the one still open (`deploy-report.yml`). `npm run report-deploy -- --dry-run` prints what it would say for the newest failed one. A failed smoke check comes after `wrangler deploy`, so the new build may be live or may not have arrived.

## What production serves

- `https://jestersprivilegepodcast.com`: the site. Both it and `www` are Worker custom domains in `wrangler.jsonc`; Cloudflare creates their DNS records and certificates on first deploy.
- `https://www.jestersprivilegepodcast.com/<path>`: a 301 to the apex, keeping path and query. The Worker (`src/worker/index.ts`) does this, which is why `run_worker_first` is on.
- `/build-manifest.json`: `{ "newestEpisodeGuid": <feed GUID or null>, "commit": <git SHA or null>, "episodeListenLinks": { <app>: [<feed GUID>, …] }, "transcripts": [<feed GUID>, …] }`, where `commit` comes from `BUILD_COMMIT` (the PR head on previews). It is written at build time by `src/app/build-manifest.json/route.ts`. The feed check reads it with `parseBuildManifest` (`src/lib/build-manifest.ts`) to decide whether to rebuild. `newestEpisodeGuid` is the newest Episode in the feed (`src/content/feed.ts`), and is null only when the feed has no Episodes. `episodeListenLinks` lists, for each app, the feed's Episodes the app's lookup found (`src/lib/episode-listen-links.ts`); an app whose lookup failed or that has none (Spotify, in a build without its key) is left out. `transcripts` lists the feed's Episodes, newest first, whose page has a Transcript.

Each Episode's Listen links come from the apps' own lookups at build time (docs/spec.md, Feed and Episodes): Apple Podcasts from Apple's public lookup, matched on the feed GUID; Spotify from the Spotify Web API's list of the show's episodes (`src/lib/spotify-lookup.ts`), matched on title and on a release day within one of the Episode's UTC publish date, since Spotify dates an episode by day with no time zone. An Episode an app doesn't list yet, or every Episode when its lookup fails, links to the show there, and the build log names the Episode and the app; a lookup never fails the build. A build from the live feed looks the apps up once, before `next build` (`npm run lookups`, `scripts/lookups.ts`, run by `npm run build`), into a gitignored snapshot, `.lookups.json`, that every page and the build manifest read: Next renders them in several worker processes, and a lookup made in each could fail in one and not another, leaving a page linking to the show while the manifest recorded the Episode's own link, which the feed check would never rebuild. Builds that read the fixture answer Apple's lookup from `src/content/apple-lookup-fixture.json`, which lists every fixture Episode but the newest and the trailer, and never ask Spotify.

Spotify needs a client-credentials key: the GitHub secrets `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`, which the preview build, the feed check, and the production build pass in. `scripts/spotify-key-wizard.sh` walks a Jester through creating the free Spotify developer app and saves both. Since February 2026 Spotify runs a Development Mode app only while its owner has Spotify Premium; if that lapses, the lookup fails with a `::warning::` and every Spotify icon opens the show until it resumes. Only a build from the live feed asks Spotify, so CI's tests and a default local build, which read the fixture, never do. A production build or feed check without either secret logs the lookup as failed, naming both, since the secrets have been deleted or renamed; every other live-feed build without them (a local `FEED=live` build, a preview) skips the lookup without a word. One with only one of them logs the lookup as failed, naming the missing secret.

## Transcripts

Spreaker makes no Transcripts, so the site makes its own (docs/spec.md, Transcripts; ADR 0003). An Episode's Transcript is the host's WebVTT when the feed links one; otherwise the site's own, saved as `<episode-guid>.vtt` (the GUID percent-encoded, `transcriptFileName` in `src/lib/transcript.ts`) on the `transcripts` branch. Builds read that branch over `raw.githubusercontent.com`. A build from the live feed reads every Episode's Transcript once, before `next build` (`npm run transcripts`, `scripts/transcripts.ts`, run by `npm run build`), into a gitignored snapshot, `.transcripts.json`, that every page and the build manifest read, for the same reason as the lookups' snapshot. An Episode with no Transcript, or one that can't be reached or read, is left without one and the build log names it and why; it never fails the build. Builds that read the fixture take the host's Transcripts from `src/content/transcripts/` and the saved ones from `src/content/saved-transcripts/`, which stands in for the branch: Episode 4 has only a saved one, Episode 1 has a saved one its host's overrides, and the bonus has neither.

`.github/workflows/transcribe.yml` makes the saved ones, every 2 hours at 47 past (half an hour after the feed check, so a new Episode deploys first and its Transcript follows) and from its **Run workflow** button (Actions → Transcribe). `npm run transcribe -- --plan` (`scripts/transcribe.ts`, logic in `src/lib/transcribe.ts`) lists the Episodes with neither a linked nor a saved Transcript; when there are none the run ends there, in about a minute. Otherwise it builds whisper.cpp (`WHISPER_VERSION`, cached with the model), transcribes each one with the `small.en` model and a prompt of the show's hard names, checks the result reads as a Transcript, and pushes it to `transcripts` as `github-actions[bot]`. The workflow creates the branch on its first run; `main`'s ruleset doesn't cover it. An Episode with a saved file is never transcribed again, so to fix a Transcript by hand, edit its file on the branch; the next feed check doesn't notice an edit, so press **Run workflow** on Deploy to publish it. A transcription failure leaves that Episode without one, logs an `::error::` naming it and why, and fails the run, which emails the repo owner; the next run tries it again. A pull request that changes the transcriber runs it for real against the live feed and uploads what it made as the run's `transcripts` artifact, pushing nothing.

To check a Transcribe change once it merges, press **Run workflow** on Transcribe, then confirm the file serves at `https://raw.githubusercontent.com/mbelmear/jesters-privilege/transcripts/<file name, percent-encoded again>` and press **Run workflow** on Deploy rather than wait for the feed check. The live `/build-manifest.json` then lists the Episode under `transcripts`. A second Transcribe run skips Whisper: its plan step sets `needed=false`, and the Transcribe step shows as skipped. #121 took this path for Episode 1.

The build reads the feed `feedSource` in `src/content/feed.ts` picks from `FEED`. Production, previews, and the feed check set `FEED=live`, the Spreaker feed; every other build (CI's tests, `npm run dev`, `npm run build` locally) reads the fixture `src/content/feed-fixture.xml`, so tests never depend on Spreaker, and `FEED=empty` reads one with no Episodes. A production build (`SITE_ENV=production`) that isn't reading the live feed fails, so the fixture can't go live. If the feed can't be reached, answers with an error, or breaks a rule (two full Episodes share a number, a full Episode has none, a required field is missing), the build fails with a message naming the Episode and the rule, and the last good deploy stays live.

Before pointing the live feed at a new address, run `npm run try-feed -- <feed url>`: it reads the feed by the build's rules and lists the page each Episode would get, or names the Episode and rule that would fail the build. Spreaker leaves an Episode's number out of the feed until it is set on the Episode's edit page, so every full Episode needs its **Episode number** set there; bonuses and trailers need none.

## Draft content

Copy awaiting the Jesters' words is marked `draft: true` in `src/content/`. Preview builds set `SITE_ENV=preview`, so a page that uses draft content shows a DRAFT ribbon there (and under `next dev`); production builds never show it.

`npm run launch-check` lists every draft that would go live (it reads the live feed, as production does) and exits 1 while any remain. It lists the drafts of the checkout it runs from, and warns first if that checkout is behind `origin/main`. It must pass before launch (#30).

`scripts/smoke-check.sh` lists what the smoke check confirms on production after each deploy. It compares the whole live `/build-manifest.json` with the `out/build-manifest.json` just built, because a deploy the feed check started rebuilds the commit already live.

## Submit endpoint

`POST /api/submit` (`src/lib/submit.ts`, wired up in `src/worker/`) takes a JSON body of at most 32 KB:

| Field            | Rule                                                                   |
| ---------------- | ---------------------------------------------------------------------- |
| `type`           | `"question"`, `"confession"`, `"topic-idea"`, or `"other"`             |
| `message`        | Required, at most 5000 characters after trimming                       |
| `name`           | Optional, at most 100 characters, one line; blank means Anonymous      |
| `email`          | Optional, a plausible address of at most 254 characters                |
| `consent`        | Must be `true`                                                         |
| `website`        | The honeypot: hidden from people, so anything in it drops the request  |
| `turnstileToken` | The Turnstile widget's token, checked with siteverify before any email |

It answers with JSON the page uses for its success and failure states:

| Status | Body                                               | Meaning                                          |
| ------ | -------------------------------------------------- | ------------------------------------------------ |
| 200    | `{ "ok": true }`                                   | Emailed to the show (or a honeypot hit, dropped) |
| 400    | `{ "ok": false, "error": "invalid", "field"?: … }` | A rule above was broken; `field` names it        |
| 403    | `{ "ok": false, "error": "verification" }`         | Turnstile rejected the token, or there was none  |
| 502    | `{ "ok": false, "error": "verification" }`         | Turnstile couldn't be reached                    |
| 502    | `{ "ok": false, "error": "delivery" }`             | The email couldn't be sent                       |

Each Submission becomes one email from `submit@` to the show's Gmail, `thejestersprivilegepodcast@gmail.com`, through the `SUBMISSION_EMAIL` send_email binding. That address must be a verified destination (Account prerequisites): the binding only delivers to verified destinations, so it can't send to the `hello@` alias. The email is the only copy; nothing is stored. Failures are logged to the Worker's logs.

To try it locally, put Turnstile's always-pass test secret in `.dev.vars` (`TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`) and run `npx wrangler dev` with a built `out/`; the email binding is simulated and prints the message.

## Account prerequisites

These Cloudflare settings can only be made by a human in the dashboard. Nothing in the repo sets them, and an agent can't see them without Cloudflare access.

- **workers.dev subdomain**: `jestersprivilege`, under **Workers & Pages › Your subdomain**. Without one, the first preview run fails. Previews are served from it, at `pr-<n>-jesters-privilege.jestersprivilege.workers.dev`.
- **Always Use HTTPS**: on, under **SSL/TLS › Edge Certificates** for `jestersprivilegepodcast.com`. Off, `http://` addresses aren't redirected to `https://`, and the smoke check fails the deploy run.
- **Email Routing destination**: `thejestersprivilegepodcast@gmail.com` added and verified, under **Compute › Email Service › Email Routing › Destination Addresses**. The Worker's `send_email` binding can only deliver to a verified destination, and Submissions fail with `delivery` until it is.
- **Routing rule**: `hello@jestersprivilegepodcast.com` forwards to that Gmail, and to no other inbox (decided 2026-11-03, #113), under **Compute › Email Service › Email Routing › Routing Rules**. Cloudflare keeps a rule disabled until its destination is verified.
- **API token permissions**: `CLOUDFLARE_API_TOKEN` needs **Account › Workers Scripts: Edit** and, for the custom domains, **Zone › Workers Routes: Edit** and **Zone › DNS: Edit** on `jestersprivilegepodcast.com`.

## Credentials

GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. `TURNSTILE_SITE_KEY` goes into the Speak Freely page as it is built; every other build (CI, local) uses Turnstile's always-pass test key, and a deploy whose secret is missing fails its build (`src/lib/turnstile.ts`). The production build also sets `SITE_ENV=production` and passes the repository variable (not secret) `WEB_ANALYTICS_TOKEN`, the site's token from **Cloudflare dashboard › Analytics & Logs › Web Analytics** for `jestersprivilegepodcast.com` (manual setup, the JS snippet's `token`). Only that build loads the beacon, so previews and CI never count visits, and it fails without the token (`src/lib/analytics.ts`). The widget's hostnames in the Turnstile dashboard must include `jestersprivilegepodcast.com` and `workers.dev`, or previews can't pass it. `TURNSTILE_SECRET_KEY` is uploaded as a Worker secret with every deploy and preview version (`--secrets-file`). The token's permissions are under Account prerequisites.

## Rolling back

```bash
npx wrangler deployments list     # find the last good version
npx wrangler rollback <version-id>
```

Or Workers & Pages → `jesters-privilege` → Deployments in the Cloudflare dashboard.
