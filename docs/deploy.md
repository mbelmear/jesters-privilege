# Deploy

The site is one Cloudflare Worker (`jesters-privilege`) serving the static export in `out/` (ADR 0001). `.github/workflows/deploy.yml` builds and deploys it with `wrangler`; the Worker's config is `wrangler.jsonc`.

## Triggers

| Trigger                                    | What happens                                                                                                                                                                                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Push to `main`                             | Build, `wrangler deploy` to production, then `scripts/smoke-check.sh`                                                                                                                                                                                                         |
| **Run workflow** button (Actions → Deploy) | The same as a push to `main`                                                                                                                                                                                                                                                  |
| Pull request                               | Build, `wrangler versions upload --preview-alias pr-<n>`, then post the preview URL as a PR comment, updated on each push. Skipped for Dependabot's and forks' pull requests, which GitHub runs without the repo's secrets, and for docs-only ones (`docs/testing.md`, In CI) |
| Every 2 hours (feed check)                 | `npm run feed-check`; only when the feed's newest Episode isn't on the live site, or an Episode has gained an Episode Listen link or a Transcript since, the same as a push to `main`                                                                                         |
| Transcribe pushes a Transcript             | Transcribe presses **Run workflow** itself, so the same as a push to `main` (Transcripts, below)                                                                                                                                                                              |

The feed check (`scripts/feed-check.ts`, logic in `src/lib/feed-check.ts`) asks the feed, the Episodes' Transcripts and the apps' lookups once, exactly as the build does, and makes the record a fresh build would publish with the same `buildRecord` (`src/lib/build-manifest.ts`). It compares that with the live `/build-manifest.json`: first the newest Episode's GUID (`newestEpisodeGuid`), then the Episodes each app lists (`episodeListenLinks`), then the Episodes that have a Transcript (`transcripts`). It takes about a minute, most of it installing dependencies, and sets the job output `rebuild`:

- **Same Episode, no new Episode Listen links or Transcripts**: `rebuild=false`, and the deploy job is skipped.
- **An Episode has gained an Episode Listen link**: `rebuild=true`, and the deploy job ships it, so a new Episode's Apple Podcasts and Spotify links arrive on their own within a feed check or two of each app listing it. An Episode that lost one, as when an app's lookup fails, doesn't rebuild; a failed lookup logs a `::warning::` naming the app and why.
- **An Episode has gained a Transcript**: `rebuild=true`. Transcribe deploys the Transcripts it saves itself (Transcripts, below), so this catches the ones it didn't: those from a run that failed, or whose Deploy failed. An Episode whose Transcript can't be had this time doesn't rebuild; a `::warning::` names it and why. A new Episode gets one too, until Transcribe reaches it.
- **Different Episode**: `rebuild=true`, and the deploy job builds and ships as for a push. The next check finds the new Episode live and stands down, so one new Episode makes one deploy (two, if the build is handed a stale cached copy of the feed; the next check then catches up).
- **Feed can't be read or breaks a rule, or the live manifest is missing, unreachable, or not valid**: the job fails with an `::error::` naming why, nothing deploys, and the live site stays as it is. Every failure opens an issue titled "Feed check is failing", or comments on the one still open (`deploy-report.yml`), so an outage adds at most one comment every 2 hours. The next feed check that passes closes it. A manifest the check can't read doesn't trigger a rebuild, which could repeat every 2 hours unnoticed; once the cause is fixed, the **Run workflow** button redeploys.

Release day means pressing the **Run workflow** button, which deploys whatever the feed holds, until #302 gives a new Episode a trigger that doesn't wait for the schedule. GitHub delays and drops scheduled runs under load and promises no rate ([docs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)): both this schedule and Transcribe's ask for 12 runs a day, but each ran 3 to 4 times a day from 2026-11-12 to 11-21 and twice a day, about 12 hours apart, from 11-22 to 11-25, some starting almost an hour late (#298). So a new Episode can wait about 12 hours for the feed check, and more `cron` lines buy nothing. GitHub also disables schedules in a public repo after 60 days without a commit; Actions → Deploy shows a banner with a button to turn it back on. A failed scheduled run emails whoever last changed the `cron` line or re-enabled the schedule, and one from the button or a push emails whoever triggered it, each if their GitHub notification settings ask for that.

Wrangler uploads PR versions to the separate `jesters-privilege-preview` Worker from `wrangler.preview.jsonc`. A maintainer creates this Worker once before running previews. The preview token can upload versions of this Worker only.

Before it builds, the deploy job checks that `wrangler.jsonc`'s `send_email` destination is a verified Email Routing destination address, asking the Cloudflare API (`npm run email-destination`, `src/lib/email-destination.ts`). Unlisted, not yet verified, or unreadable (the token lacking its permission included), it fails with an `::error::` naming the address and where to fix it, and nothing deploys: until 2026-11-03 every Submission failed with `delivery` because the Worker sent to an address that wasn't one, and no test, preview, or smoke check could see it (#114). If the build fails, the workflow stops before `wrangler deploy`, so the last good deploy stays live. A failed run emails as Triggers says, and a failed **Deploy to production** job also opens an issue titled "Production deploy is failing", or comments on the one still open (`deploy-report.yml`). `npm run report-deploy -- --dry-run` prints what it would say for the newest failed one, and for the newest failed feed check. A failed smoke check comes after `wrangler deploy`, so the new build may be live or may not have arrived.

## What production serves

- `https://jestersprivilegepodcast.com`: the site. Both it and `www` are Worker custom domains in `wrangler.jsonc`; Cloudflare creates their DNS records and certificates on first deploy.
- `https://www.jestersprivilegepodcast.com/<path>`: a 301 to the apex, keeping path and query. The Worker (`src/worker/index.ts`) does this, which is why `run_worker_first` is on.
- `/build-manifest.json`: `{ "newestEpisodeGuid": <feed GUID or null>, "commit": <git SHA or null>, "episodeListenLinks": { <app>: [<feed GUID>, …] }, "transcripts": [<feed GUID>, …] }`, where `commit` comes from `BUILD_COMMIT` (the PR head on previews). It is written at build time by `src/app/build-manifest.json/route.ts`. The feed check reads it with `parseBuildManifest` (`src/lib/build-manifest.ts`) to decide whether to rebuild. `newestEpisodeGuid` is the newest Episode in the feed (`src/content/feed.ts`), and is null only when the feed has no Episodes. `episodeListenLinks` lists, for each app, the feed's Episodes the app's lookup found (`src/lib/episode-listen-links.ts`); an app whose lookup failed, or that the build didn't ask (Spotify, in a build from the fixture), is left out. `transcripts` lists the feed's Episodes, newest first, whose page has a Transcript.

Each Episode's Listen links come from the apps' own lookups at build time (docs/spec.md, Feed and Episodes): Apple Podcasts from Apple's public lookup, matched on the feed GUID; Spotify from the Spotify Web API's list of the show's episodes (`src/lib/spotify-lookup.ts`), matched on title and on a release day within one of the Episode's UTC publish date, since Spotify dates an episode by day with no time zone. An Episode an app doesn't list yet, or every Episode when its lookup fails, links to the show there, and the build log names the Episode and the app; a lookup never fails the build. Every build looks the apps up once, before `next build` (`npm run snapshot`, `scripts/snapshot.ts`, run by `npm run build`), into a gitignored snapshot, `.feed-snapshot.json`, that every page and the build manifest read, along with the feed and its Transcripts (`src/lib/episode-feed.ts`): Next renders them in several worker processes, and a lookup made in each could fail in one and not another, leaving a page linking to the show while the manifest recorded the Episode's own link, which the feed check would never rebuild. Builds that read the fixture answer Apple's lookup from `src/content/apple-lookup-fixture.json`, which lists every fixture Episode but the newest and the trailer, and never ask Spotify.

Spotify needs a client-credentials key: the GitHub secrets `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`, which the preview build, the feed check, and the production build pass in. `scripts/spotify-key-wizard.sh` walks a Jester through creating the free Spotify developer app and saves both. Since February 2026 Spotify runs a Development Mode app only while its owner has Spotify Premium; if that lapses, the lookup fails with a `::warning::` and every Spotify icon opens the show until it resumes. Only a build from the live feed asks Spotify, so CI's tests and a default local build, which read the fixture, never do. Every workflow run that asks Spotify is handed both secrets (fork and Dependabot pull requests get no preview), so one without them (`spotifyKey`, `src/lib/spotify-lookup.ts`) logs the lookup as failed, naming each missing secret: the secrets have been deleted or renamed. A local `FEED=live` build without them logs the same.

## Transcripts

Spreaker makes no Transcripts, so the site makes its own (docs/spec.md, Transcripts; ADR 0003). An Episode's Transcript is the host's WebVTT when the feed links one; otherwise the site's own, saved as `<episode-guid>.vtt` (the GUID percent-encoded, `transcriptFileName` in `src/lib/transcript.ts`) on the `transcripts` branch. Builds read that branch over `raw.githubusercontent.com` (`liveSource` in `src/lib/feed-source.ts`); Transcribe decides which Episodes already have one from its own git checkout of the branch instead (`isSaved` in `scripts/transcribe.ts`), so a change to how builds read it leaves what Transcribe skips alone. Every build reads every Episode's Transcript once, before `next build`, into the same snapshot, `.feed-snapshot.json` (`npm run snapshot`), for the same reason as the lookups. An Episode with no Transcript, or one that can't be reached or read, is left without one and the build log names it and why; it never fails the build. Builds that read the fixture take the host's Transcripts from `src/content/transcripts/` and the saved ones from `src/content/saved-transcripts/`, which stands in for the branch: Episode 4 has only a saved one, Episode 1 has a saved one its host's overrides, and the bonus has neither.

`.github/workflows/transcribe.yml` makes the saved ones, every 2 hours at 47 past (half an hour after the feed check, so a new Episode is usually live before its Transcript arrives) and from its **Run workflow** button (Actions → Transcribe). A scheduled run is as unreliable as the feed check (Triggers), so an Episode may wait up to about 12 hours for its Transcript. `npm run transcribe -- --plan` (`scripts/transcribe.ts`, logic in `src/lib/transcribe.ts`) lists the Episodes with neither a linked nor a saved Transcript; when there are none the run ends there, in about a minute. Otherwise it builds whisper.cpp (`WHISPER_VERSION`, cached with the model), transcribes each one with the `small.en` model and a prompt of the show's hard names, checks the result reads as a Transcript, and pushes it to `transcripts` as `github-actions[bot]`. A run that pushed and failed nothing then starts Deploy (`gh workflow run deploy.yml --ref main`, the Start Deploy step), whose smoke check confirms the live `/build-manifest.json` matches the build, its `transcripts` included, so the Transcript is on the site within minutes rather than at the next feed check. Only that way works: a push made with the workflow's `GITHUB_TOKEN` starts no workflow, but a `workflow_dispatch` does ([docs](https://docs.github.com/en/actions/concepts/security/github_token)). It is not a fallback (CODING_STANDARDS.md, Failures are loud): it runs once and never retries. A run that pushed nothing, a pull request's, and a failed one start no deploy; a failed run's saved Transcripts wait for the feed check. The workflow creates the branch on its first run; `main`'s ruleset doesn't cover it. An Episode with a saved file is never transcribed again, so to fix a Transcript by hand, edit its file on the branch; the next feed check doesn't notice an edit, so press **Run workflow** on Deploy to publish it. A transcription failure leaves that Episode without one, logs an `::error::` naming it and why, and fails the run, which emails as a failed deploy run does (Triggers); the next run tries it again. Each Episode gets this only in its first week. A scheduled run, or a pull request's, takes only Episodes published in the last 7 days (`NEW_FOR_DAYS` in `src/lib/transcribe.ts`): an older Episode with nothing saved means the branch lost a file or was read wrong, so rather than spend Whisper's hour on it the run logs an `::error::` naming it (title and GUID) and fails, after transcribing any new ones. Only a run from **Run workflow** (`TRANSCRIBE_ANY_AGE`) transcribes an older Episode, so press it to remake a lost Transcript on purpose (#240). A pull request that changes the transcriber runs it for real against the live feed and uploads what it made as the run's `transcripts` artifact, pushing nothing.

To check a Transcribe change once it merges, press **Run workflow** on Transcribe, then confirm the file serves at `https://raw.githubusercontent.com/mbelmear/jesters-privilege/transcripts/<file name, percent-encoded again>` and that a `workflow_dispatch` run of Deploy started as the Transcribe run ended. Once it finishes, the live `/build-manifest.json` lists the Episode under `transcripts`. A second Transcribe run skips Whisper: its plan step sets `needed=false`, and the Transcribe step shows as skipped. #121 took this path for Episode 1.

The build reads the feed that `src/content/feed.ts` picks from `FEED` (`chooseFeedSource`), once, in `npm run snapshot`. Production, previews, and the feed check set `FEED=live`, the Spreaker feed; every other build (CI's tests, `npm run dev`, `npm run build` locally) reads the fixture `src/content/feed-fixture.xml`, so tests never depend on Spreaker, and `FEED=empty` reads one with no Episodes. A production build (`SITE_ENV=production`) that isn't reading the live feed fails, so the fixture can't go live. If the feed can't be reached, answers with an error, or breaks a rule (two full Episodes share a number, a full Episode has none, a required field is missing), the build fails with a message naming the Episode and the rule, and the last good deploy stays live.

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

Each Submission becomes one email from `submit@` to the show's Gmail, `thejestersprivilegepodcast@gmail.com`, through the `SUBMISSION_EMAIL` send_email binding. That address must be a verified destination (Account prerequisites): the binding only delivers to verified destinations, so it can't send to the `hello@` alias. The email is the only copy; nothing is stored. The Worker's logs record every request's status, with the error when Turnstile can't be reached or the email can't be sent, and `wrangler.jsonc` keeps them on (`observability`, Workers Logs): a Jester reads them under **Workers & Pages › jesters-privilege › Observability**. They're kept for 7 days, or 3 on the free Workers plan until Workers Logs move to Cloudflare Observability pricing on 2026-12-01 (#231), then gone ([Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/), [Observability pricing](https://developers.cloudflare.com/observability/pricing/), 2026-11-16). Agents have no Cloudflare log access, as decided on #46.

To try it locally, put Turnstile's always-pass test secret in `.dev.vars` (`TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`) and run `npx wrangler dev` with a built `out/`; the email binding is simulated and prints the message.

## Account prerequisites

These Cloudflare settings can only be made by a human in the dashboard, and nothing in the repo sets them. Nightly checks the two Email Routing ones each night with a read-only token (`npm run email-routing-check`, logic in `src/lib/email-routing-check.ts`) and fails, opening its "Nightly is failing" issue, when either is wrong. A missing workers.dev subdomain or Always Use HTTPS fails a run already, as each says, and a token missing a permission fails the run that needs it.

- **workers.dev subdomain**: `jestersprivilege`, under **Workers & Pages › Your subdomain**. Without one, the first preview run fails. Previews are served from it, at `pr-<n>-jesters-privilege-preview.jestersprivilege.workers.dev`.
- **Always Use HTTPS**: on, under **SSL/TLS › Edge Certificates** for `jestersprivilegepodcast.com`. Off, `http://` addresses aren't redirected to `https://`, and the smoke check fails the deploy run.
- **Email Routing destination**: `thejestersprivilegepodcast@gmail.com` added and verified, under **Compute › Email Service › Email Routing › Destination Addresses**. The Worker's `send_email` binding can only deliver to a verified destination, and Submissions fail with `delivery` until it is, so the deploy job refuses to deploy until it is, and Nightly fails on any night it isn't one, or isn't verified.
- **Routing rule**: `hello@jestersprivilegepodcast.com` forwards to that Gmail, and to no other inbox (decided 2026-11-03, #113), under **Compute › Email Service › Email Routing › Routing Rules**. Cloudflare keeps a rule disabled until its destination is verified. Nightly fails while no enabled rule matches `hello@`, or one sends it anywhere but that Gmail (another inbox, a Worker, a drop); the catch-all and other addresses' rules aren't checked, so mail to any other address at the domain is wherever those rules send it, with no failure.
- **API token permissions**: `PRODUCTION_CLOUDFLARE_API_TOKEN` needs **Account › Workers Scripts: Edit**; **Account › Email Routing Addresses: Read**, for the deploy's Email Routing check, which fails without it; and, for the custom domains, **Zone › Workers Routes: Edit** and **Zone › DNS: Edit** on `jestersprivilegepodcast.com`. `CLOUDFLARE_READ_TOKEN`, Nightly's, is a separate token that only reads: **Account › Email Routing Addresses: Read**, **Zone › Email Routing Rules: Read**, and **Zone › Zone: Read**, with the zone limited to `jestersprivilegepodcast.com` (names as Cloudflare's [API token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/) gave them on 2026-11-08). `scripts/cloudflare-read-token-wizard.sh` walks a human through creating it and saves it.

## Credentials

Create a GitHub deployment environment named `production` with a deployment branch policy allowing only the branch `main`. Scheduled feed deployments use this environment too, so leave required deployment reviewers disabled for unattended publishing.

| Location                        | Secrets                                                                                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub `production` environment | `PRODUCTION_CLOUDFLARE_API_TOKEN`, `PRODUCTION_CLOUDFLARE_ACCOUNT_ID`, `PRODUCTION_TURNSTILE_SITE_KEY`, `PRODUCTION_TURNSTILE_SECRET_KEY`                                                           |
| GitHub repository               | `PREVIEW_CLOUDFLARE_API_TOKEN`, `PREVIEW_CLOUDFLARE_ACCOUNT_ID`, `PREVIEW_TURNSTILE_SITE_KEY`, `PREVIEW_TURNSTILE_SECRET_KEY`, plus `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_READ_TOKEN` for Nightly |

Create the preview Worker once with a maintainer credential that can create Workers, using a local build and `npx wrangler deploy --config wrangler.preview.jsonc`. Configure a separate Turnstile widget for the preview hostnames. Give the preview account-owned API token the Workers Editor role scoped specifically to `jesters-privilege-preview`. Verify the token cannot list deployments for the production Worker and can upload preview versions. Both Workers deliver test or real Submissions to the show's verified inbox, so identify test Submissions when testing the preview.

### Credential cutover

1. Populate the new secrets and confirm the preview build and Speak Freely on the PR before merging. Use a fresh production Cloudflare token for the new environment. Keep its value only in that environment.
2. Merge through the normal PR gate during a monitored deployment window. Confirm the automatic production deploy and smoke check succeed, then remove the old repository-level `CLOUDFLARE_API_TOKEN`, `TURNSTILE_SITE_KEY`, and `TURNSTILE_SECRET_KEY`. Keep the repository-level `CLOUDFLARE_ACCOUNT_ID` for Nightly’s Email Routing check. Revoke the old shared Cloudflare token and rotate the production Turnstile secret if it was previously shared with previews. Verify a production deploy and a test Submission after rotation.

The site key goes into the Speak Freely page at build time. CI and local builds use Turnstile's always-pass test key (`src/lib/turnstile.ts`). Each workflow uploads its matching secret key to its Worker. Only production uses the repository variable `WEB_ANALYTICS_TOKEN` to load the analytics beacon (`src/lib/analytics.ts`).

## Rolling back

```bash
npx wrangler deployments list     # find the last good version
npx wrangler rollback <version-id>
```

Or Workers & Pages → `jesters-privilege` → Deployments in the Cloudflare dashboard.

## Versions

The site's version is `version` in `package.json` (and `package-lock.json`, which `npm version` keeps in step). It follows [semantic versioning](https://semver.org), read for a website:

| Part  | Goes up for                                        | Example                                   |
| ----- | -------------------------------------------------- | ----------------------------------------- |
| Major | A new spec: a redesign, or the next `docs/spec.md` | 1.4.2 → 2.0.0                             |
| Minor | Something new a visitor can see or do              | A Scripture index page: 1.4.2 → 1.5.0     |
| Patch | Fixes, copy, dependencies, tooling, docs           | The Listen icons reordered: 1.4.2 → 1.4.3 |

1.0.0 is v1 as of #284; the site has been live since 2026-11-11.

A ticket's PR never changes the version: several sessions build tickets at once, and each bumping the same line would conflict. So a release bundles every change merged since the last one, and takes the biggest part any of them calls for. It is its own small PR, with its own issue and worktree (`AGENTS.md`), when Michael decides the work merged since the last release is worth naming. It changes nothing but the version:

```bash
npm version <major|minor|patch> --no-git-tag-version   # updates both files
```

Once it merges, Michael, or an agent he asks, tags the merge commit and publishes the release, whose notes GitHub writes from the PRs merged since the previous release:

```bash
gh release create v<version> --target <merge commit SHA> --title v<version> --generate-notes
```

v1.0.0, the first release, has no previous one, so generated notes would list every PR since the repo began; it gets written notes instead (`--notes`, in place of `--generate-notes`).

Deploys don't wait for a release: every merge to `main` goes live as before, so the version names a point in that stream, not what is deployed.
