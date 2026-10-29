# Jester's Privilege

The website for the Jester's Privilege podcast: a fast, static, mobile-first site built with Next.js and served from Cloudflare. What it does and why is in [`docs/spec.md`](docs/spec.md); the words it uses are in [`GLOSSARY.md`](GLOSSARY.md).

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

| Command                | What it does                              |
| ---------------------- | ----------------------------------------- |
| `npm run dev`          | Start the dev server                      |
| `npm run build`        | Export the static site to `out/`          |
| `npm test`             | Unit and component tests (Jest)           |
| `npm run test:e2e`     | Browser tests against `out/` (Playwright) |
| `npm run lighthouse`   | Mobile performance budget against `out/`  |
| `npm run typecheck`    | Type-check the project                    |
| `npm run format`       | Format everything with Prettier           |
| `npm run merge -- <n>` | Merge PR `<n>` once every check is green  |

How each test layer works and how to run it locally: [`docs/testing.md`](docs/testing.md).
