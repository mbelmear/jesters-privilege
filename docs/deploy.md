# Deploy

The site is one Cloudflare Worker (`jesters-privilege`) serving the static export in `out/` (ADR 0001). `.github/workflows/deploy.yml` builds and deploys it with `wrangler`; the Worker's config is `wrangler.jsonc`.

## Triggers

| Trigger                                    | What happens                                                                                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Push to `main`                             | Build, `wrangler deploy` to production, then `scripts/smoke-check.sh`                                                                                                 |
| **Run workflow** button (Actions → Deploy) | The same as a push to `main`                                                                                                                                          |
| Pull request                               | Build, `wrangler versions upload --preview-alias pr-<n>`, then post the preview URL as a PR comment, updated on each push                                             |
| Every 2 hours (feed check)                 | `npm run feed-check`; only when the feed's newest Episode isn't on the live site, or an Episode has gained an Episode Listen link since, the same as a push to `main` |

The feed check (`scripts/feed-check.ts`, logic in `src/lib/feed-check.ts`) reads the feed exactly as the build does and compares its newest Episode's GUID with `newestEpisodeGuid` in the live `/build-manifest.json`, then looks the Episodes up in the apps as the build does and compares the Episodes each app lists with `episodeListenLinks`. It takes about a minute, most of it installing dependencies, and sets the job output `rebuild`:

- **Same Episode, no new Episode Listen links**: `rebuild=false`, and the deploy job is skipped.
- **An Episode has gained an Episode Listen link**: `rebuild=true`, and the deploy job ships it, so a new Episode's Apple Podcasts link arrives on its own within a feed check or two of Apple listing it. An Episode that lost one, as when an app's lookup fails, doesn't rebuild; a failed lookup logs a `::warning::` naming the app and why.
- **Different Episode**: `rebuild=true`, and the deploy job builds and ships as for a push. The next check finds the new Episode live and stands down, so one new Episode makes one deploy (two, if the build is handed a stale cached copy of the feed; the next check then catches up).
- **Feed can't be read or breaks a rule, or the live manifest is missing, unreachable, or not valid**: the job fails with an `::error::` naming why, nothing deploys, and the live site stays as it is. A manifest the check can't read doesn't trigger a rebuild, which could repeat every 2 hours unnoticed; once the cause is fixed, the **Run workflow** button redeploys.

Release day doesn't wait for the schedule: the **Run workflow** button deploys whatever the feed holds. GitHub may start a scheduled run some minutes late, and it disables schedules in a public repo after 60 days without a commit; Actions → Deploy shows a banner with a button to turn it back on. A failed scheduled run emails whoever last changed the `cron` line.

Wrangler can't upload a preview version to a Worker that doesn't exist yet. If no Worker exists, the preview job first creates it with a blank placeholder page on workers.dev, with no custom domains. That happens once, before the first production deploy.

If the build fails, the workflow stops before `wrangler deploy`, so the last good deploy stays live. A failed run emails the repo owner through GitHub's default Actions notifications.

## What production serves

- `https://jestersprivilegepodcast.com`: the site. Both it and `www` are Worker custom domains in `wrangler.jsonc`; Cloudflare creates their DNS records and certificates on first deploy.
- `https://www.jestersprivilegepodcast.com/<path>`: a 301 to the apex, keeping path and query. The Worker (`src/worker/index.ts`) does this, which is why `run_worker_first` is on.
- `/build-manifest.json`: `{ "newestEpisodeGuid": <feed GUID or null>, "commit": <git SHA or null>, "episodeListenLinks": { <app>: [<feed GUID>, …] } }`, where `commit` comes from `BUILD_COMMIT` (the PR head on previews). It is written at build time by `src/app/build-manifest.json/route.ts`. The feed check reads it with `parseBuildManifest` (`src/lib/build-manifest.ts`) to decide whether to rebuild. `newestEpisodeGuid` is the newest Episode in the feed (`src/content/feed.ts`), and is null only when the feed has no Episodes. `episodeListenLinks` lists, for each app, the feed's Episodes the app's lookup found (`src/lib/episode-listen-links.ts`); an app whose lookup failed or that has none (Spotify until #122) is left out.

Each Episode's Listen links come from the apps' own lookups at build time (docs/spec.md, Feed and Episodes): Apple Podcasts from Apple's public lookup, matched on the feed GUID. An Episode an app doesn't list yet, or every Episode when its lookup fails, links to the show there, and the build log names the Episode and the app; a lookup never fails the build. A build from the live feed looks the apps up once, before `next build` (`npm run lookups`, `scripts/lookups.ts`, run by `npm run build`), into a gitignored snapshot, `.lookups.json`, that every page and the build manifest read: Next renders them in several worker processes, and a lookup made in each could fail in one and not another, leaving a page linking to the show while the manifest recorded the Episode's own link, which the feed check would never rebuild. Builds that read the fixture answer Apple's lookup from `src/content/apple-lookup-fixture.json`, which lists every fixture Episode but the newest and the trailer.

The build reads the feed `feedSource` in `src/content/feed.ts` picks from `FEED`. Production, previews, and the feed check set `FEED=live`, the Spreaker feed; every other build (CI's tests, `npm run dev`, `npm run build` locally) reads the fixture `src/content/feed-fixture.xml`, so tests never depend on Spreaker, and `FEED=empty` reads one with no Episodes. A production build (`SITE_ENV=production`) that isn't reading the live feed fails, so the fixture can't go live. If the feed can't be reached, answers with an error, or breaks a rule (two full Episodes share a number, a full Episode has none, a required field is missing), the build fails with a message naming the Episode and the rule, and the last good deploy stays live.

Before pointing the live feed at a new address, run `npm run try-feed -- <feed url>`: it reads the feed by the build's rules and lists the page each Episode would get, or names the Episode and rule that would fail the build. Spreaker leaves an Episode's number out of the feed until it is set on the Episode's edit page, so every full Episode needs its **Episode number** set there; bonuses and trailers need none.

## Draft content

Copy awaiting the Jesters' words is marked `draft: true` in `src/content/`. Preview builds set `SITE_ENV=preview`, so a page that uses draft content shows a DRAFT ribbon there (and under `next dev`); production builds never show it.

`npm run launch-check` lists every draft that would go live (it reads the live feed, as production does) and exits 1 while any remain. It must pass before launch (#30).

The smoke check confirms the manifest shows the commit just deployed, the home page serves, and `www` redirects.

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

Each Submission becomes one email from `submit@` to the show's Gmail, `thejestersprivilegepodcast@gmail.com`, through the `SUBMISSION_EMAIL` send_email binding. That address must be a verified destination address in **Email Routing › Destination addresses**: the binding only delivers to verified destinations, so it can't send to the `hello@` alias. The email is the only copy; nothing is stored. Failures are logged to the Worker's logs.

To try it locally, put Turnstile's always-pass test secret in `.dev.vars` (`TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`) and run `npx wrangler dev` with a built `out/`; the email binding is simulated and prints the message.

## Credentials

GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. `TURNSTILE_SITE_KEY` goes into the Speak Freely page as it is built; every other build (CI, local) uses Turnstile's always-pass test key, and a deploy whose secret is missing fails its build (`src/lib/turnstile.ts`). The production build also sets `SITE_ENV=production` and passes the repository variable (not secret) `WEB_ANALYTICS_TOKEN`, the site's token from **Cloudflare dashboard › Analytics & Logs › Web Analytics** for `jestersprivilegepodcast.com` (manual setup, the JS snippet's `token`). Only that build loads the beacon, so previews and CI never count visits, and it fails without the token (`src/lib/analytics.ts`). The widget's hostnames in the Turnstile dashboard must include `jestersprivilegepodcast.com` and `workers.dev`, or previews can't pass it. `TURNSTILE_SECRET_KEY` is uploaded as a Worker secret with every deploy and preview version (`--secrets-file`). The token needs **Account › Workers Scripts: Edit** and, for the custom domains, **Zone › Workers Routes: Edit** and **Zone › DNS: Edit** on `jestersprivilegepodcast.com`.

## Rolling back

```bash
npx wrangler deployments list     # find the last good version
npx wrangler rollback <version-id>
```

Or Workers & Pages → `jesters-privilege` → Deployments in the Cloudflare dashboard.
