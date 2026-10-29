# Deploy

The site is one Cloudflare Worker (`jesters-privilege`) serving the static export in `out/` (ADR 0001). `.github/workflows/deploy.yml` builds and deploys it with `wrangler`; the Worker's config is `wrangler.jsonc`.

## Triggers

| Trigger                                    | What happens                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Push to `main`                             | Build, `wrangler deploy` to production, then `scripts/smoke-check.sh`                                                     |
| **Run workflow** button (Actions → Deploy) | The same as a push to `main`                                                                                              |
| Pull request                               | Build, `wrangler versions upload --preview-alias pr-<n>`, then post the preview URL as a PR comment, updated on each push |
| Every 2 hours (feed check, #18)            | Not yet built                                                                                                             |

Wrangler can't upload a preview version to a Worker that doesn't exist yet. If no Worker exists, the preview job first creates it with a blank placeholder page on workers.dev, with no custom domains. That happens once, before the first production deploy.

If the build fails, the workflow stops before `wrangler deploy`, so the last good deploy stays live. A failed run emails the repo owner through GitHub's default Actions notifications.

## What production serves

- `https://jestersprivilegepodcast.com`: the site. Both it and `www` are Worker custom domains in `wrangler.jsonc`; Cloudflare creates their DNS records and certificates on first deploy.
- `https://www.jestersprivilegepodcast.com/<path>`: a 301 to the apex, keeping path and query. The Worker (`src/worker/index.ts`) does this, which is why `run_worker_first` is on.
- `/build-manifest.json`: `{ "newestEpisodeGuid": <feed GUID or null>, "commit": <git SHA or null> }`, where `commit` comes from `BUILD_COMMIT` (the PR head on previews). It is written at build time by `src/app/build-manifest.json/route.ts`. The feed check reads it with `parseBuildManifest` (`src/lib/build-manifest.ts`) to decide whether to rebuild. `newestEpisodeGuid` is the newest Episode in the feed (`src/content/feed.ts`), and is null only when the feed has no Episodes.

The build reads the feed from `feedSource` in `src/content/feed.ts`: a fixture (`src/content/feed-fixture.xml`) until Episode 1 is published, then the Spreaker feed URL. If the feed can't be reached, answers with an error, or breaks a rule (two full Episodes share a number, a full Episode has none, a required field is missing), the build fails with a message naming the Episode and the rule, and the last good deploy stays live.

## Draft content

Copy awaiting the Jesters' words is marked `draft: true` in `src/content/`. Preview builds set `SITE_ENV=preview`, so a page that uses draft content shows a DRAFT ribbon there (and under `next dev`); production builds never show it.

`npm run launch-check` lists every draft, including the fixture feed, and exits 1 while any remain. It must pass before launch (#30).

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

Each Submission becomes one email from `submit@` to `hello@jestersprivilegepodcast.com` through the `SUBMISSION_EMAIL` send_email binding, and is stored nowhere else. Failures are logged to the Worker's logs.

To try it locally, put Turnstile's always-pass test secret in `.dev.vars` (`TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`) and run `npx wrangler dev` with a built `out/`; the email binding is simulated and prints the message.

## Credentials

GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. `TURNSTILE_SECRET_KEY` is uploaded as a Worker secret with every deploy and preview version (`--secrets-file`). The token needs **Account › Workers Scripts: Edit** and, for the custom domains, **Zone › Workers Routes: Edit** and **Zone › DNS: Edit** on `jestersprivilegepodcast.com`.

## Rolling back

```bash
npx wrangler deployments list     # find the last good version
npx wrangler rollback <version-id>
```

Or Workers & Pages → `jesters-privilege` → Deployments in the Cloudflare dashboard.
