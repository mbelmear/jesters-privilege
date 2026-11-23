<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/horizontal-tagline-dark.png">
    <img src="public/brand/horizontal-tagline.png" alt="Jester's Privilege: Theology in the Motley" width="420">
  </picture>
</p>

<p align="center">
  <b>A weekly theology-and-humor podcast from three Jesters who serve the King.</b><br>
  <a href="https://jestersprivilegepodcast.com">jestersprivilegepodcast.com</a>
</p>

<p align="center">
  <a href="https://github.com/mbelmear/jesters-privilege/actions/workflows/deploy.yml"><img src="https://github.com/mbelmear/jesters-privilege/actions/workflows/deploy.yml/badge.svg?branch=main" alt="Deploy"></a>
  <a href="https://github.com/mbelmear/jesters-privilege/actions/workflows/ci.yml"><img src="https://github.com/mbelmear/jesters-privilege/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
  <a href="https://github.com/mbelmear/jesters-privilege/actions/workflows/nightly.yml"><img src="https://github.com/mbelmear/jesters-privilege/actions/workflows/nightly.yml/badge.svg" alt="Nightly"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/code-MIT-blue" alt="Code: MIT"></a>
</p>

# Jester's Privilege

The show's website: a fast, static, mobile-first site built with Next.js and served from a Cloudflare Worker. New Episodes arrive from the Spreaker feed on their own, so nobody touches the site when an Episode is published. What it does and why is in [`docs/spec.md`](docs/spec.md); the words it uses are in [`GLOSSARY.md`](GLOSSARY.md).

<p align="center">
  <img src="docs/readme/episode-desktop.png" alt="Episode 1, Celebrity Pastors, on a desktop: Play and Share buttons, links to the podcast apps, the Show notes, and the start of the Transcript" width="68%">
  &nbsp;
  <img src="docs/readme/gallery-phone.jpg" alt="The Fools' Gallery on a phone: its title, introduction, and a painting of a holy fool in a Russian winter crowd" width="22%">
</p>

## What's on the site

- **Home**: the jester story, the latest Episode, a glimpse of the Fools' Gallery, and the Jesters
- **Episodes**: every Episode, playable in place, each with its Show notes and, once transcribed, its Transcript
- **Fools' Gallery**: the history of court jesters and holy fools as a timeline, each Fool with a public-domain painting
- **About**: why the show is called "Jester's Privilege", and who the Jesters are
- **Speak Freely**: where listeners send Questions, Confessions, and Topic ideas
- A persistent player that keeps playing while you browse

## How it's built

The site is built agent-first. The Jesters' brief became [`docs/spec.md`](docs/spec.md) in a grilling session, the spec became tickets on GitHub Issues, and coding agents build each ticket test-first in its own git worktree. Every pull request is reviewed against [`CODING_STANDARDS.md`](CODING_STANDARDS.md) and its ticket before it merges, and GitHub's merge button stays shut until a required `PR gate` status says the pull request's head has passed that review. Anything a visitor sees waits for a Jester's approval on a preview deploy. After a ticket ships, a retro turns what went wrong into a check, a script, or a coding standard, so the next ticket starts from a better place. The full rules are in [`AGENTS.md`](AGENTS.md) and [`docs/testing.md`](docs/testing.md).

Three test layers guard it: Jest with React Testing Library and jest-axe for logic and components, Playwright on Chromium and WebKit at phone and desktop sizes, and a Lighthouse CI budget for mobile performance.

## Getting started

Use Node 24, the version in `.nvmrc`: newer versions fail a unit test that passes in CI.

```bash
nvm use
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

| Command                    | What it does                              |
| -------------------------- | ----------------------------------------- |
| `npm run dev`              | Start the dev server                      |
| `npm run build`            | Export the static site to `out/`          |
| `npm test`                 | Unit and component tests (Jest)           |
| `npm run test:e2e`         | Browser tests against `out/` (Playwright) |
| `npm run lighthouse`       | Mobile performance budget against `out/`  |
| `npm run typecheck`        | Type-check the project                    |
| `npm run format`           | Format everything with Prettier           |
| `npm run pr-status -- <n>` | Wait for PR `<n>`'s checks and preview    |

How each test layer works and how to run it locally: [`docs/testing.md`](docs/testing.md).

## Listening, questions, and feedback

To ask the Jesters a Question, send a Confession, or suggest a Topic, use [Speak Freely](https://jestersprivilegepodcast.com/speak-freely) on the site, not GitHub Issues. Issues here are the build's own tickets. If a Transcript gets something wrong, Speak Freely is the place for that too.

## License

The code is under the [MIT License](LICENSE). The show's name, logos and artwork, the Jesters' photos, the site's copy, and the Episodes themselves are © the Jesters, all rights reserved. The Fools' paintings are public domain, each with its source in `src/content/paintings.ts`. The fonts keep their own SIL Open Font License.
