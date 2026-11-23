# Security policy

## Reporting a vulnerability

Please report security problems privately, through GitHub's [private vulnerability reporting](https://github.com/mbelmear/jesters-privilege/security/advisories/new) (the repo's **Security** tab › **Report a vulnerability**). Don't open a public issue, and don't use the site's Speak Freely form: Submissions are read by the show, not the maintainer.

Include what you found, where, and the steps that show it. The maintainer replies in the advisory, and credits the reporter there unless they ask not to be.

## Scope

In scope:

- **The site**, `jestersprivilegepodcast.com` and `www`, and its preview versions on `workers.dev`
- **The Submit endpoint**, `POST /api/submit` (`src/lib/submit.ts`, `src/worker/`): validation, the Turnstile check, and the email it sends
- **The GitHub Actions workflows** (`.github/workflows/`): anything that would let someone outside the repo run code with its secrets or write to `main` or the `transcripts` branch
- **The build**: anything in the feed, a Transcript, or a podcast app's lookup that could put a script or markup on a page

Out of scope: Spreaker, Cloudflare, GitHub, Apple, and Spotify themselves (report those to each vendor); findings that need a compromised maintainer account; volumetric denial of service; and missing hardening headers with no demonstrated impact.

## Supported versions

Only what is live on `jestersprivilegepodcast.com`, which is always `main`.
