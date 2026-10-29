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

## Credentials

GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The token needs **Account › Workers Scripts: Edit** and, for the custom domains, **Zone › Workers Routes: Edit** and **Zone › DNS: Edit** on `jestersprivilegepodcast.com`.

## Rolling back

```bash
npx wrangler deployments list     # find the last good version
npx wrangler rollback <version-id>
```

Or Workers & Pages → `jesters-privilege` → Deployments in the Cloudflare dashboard.
