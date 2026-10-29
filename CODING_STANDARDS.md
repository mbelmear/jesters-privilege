# Coding Standards

How code in this repo is written. `/code-review` checks every change against this file, alongside the working rules in `AGENTS.md` (vocabulary, test-first, content files, reduced motion), which apply in full and aren't repeated here.

## Enforced by tooling

These are non-negotiable, and a commit or pull request that breaks them is refused before review:

- **Tests are green.** The pre-commit hook and CI run Jest; CI also runs Playwright and Lighthouse. Logic in `src/lib/` keeps at least 90% line coverage.
- **No `any`, explicit or implicit.** `strict` TypeScript rejects implicit `any`; ESLint rejects written `any`, any value that carries `any` in from a library (`JSON.parse`, `response.json()`), non-null assertions (`!`), and type assertions other than `as const` outside tests.
- **Formatting.** Prettier, checked in CI.
- **Colors and fonts come from design tokens.** ESLint rejects literal colors (hex, `rgb()`/`hsl()`/`oklch()` and friends), Tailwind's built-in palette (`bg-black`, `text-red-500`), Tailwind arbitrary color and font-family values, and inline `font`/`fontFamily` styles anywhere in `src/` outside tests. It also rejects `text-brand`: orange text uses `text-brand-display` (large) or `text-brand-ink` (small). Tokens live in `src/app/globals.css`.

Reviewers skip these; the rules below are the ones that need judgement.

## TypeScript

- **Outside data enters as `unknown` and is narrowed at the boundary.** The boundaries are the feed text, Transcript WebVTT, the Submit request body, anything read from `localStorage`, and `catch` variables. A validator or type guard at that boundary turns `unknown` into a domain type or throws a descriptive error; past the boundary, code works only with domain types. `unknown` that leaves its boundary validator (the receiving function and the non-exported helpers it calls) is a finding.
- **Domain concepts get named types in `GLOSSARY.md` vocabulary**: `Episode`, `Fool`, `Jester`, `Submission`. A closed set is a union of string literals (`"question" | "confession" | "topic-idea" | "other"`), with one exported list as the source of truth for code that iterates it.
- **Illegal states are unrepresentable.** State with modes (the player store, the Submit form) is a discriminated union, where each variant carries exactly the fields that mode has, in place of booleans plus optional fields.
- **Switches over a union are exhaustive**, ending in a `never` check so a new variant fails to compile everywhere it needs handling.
- **Failures are loud.** A module that can't do its job throws an error that names what was wrong and where (the Feed names the Episode and the rule it broke). Fallbacks exist only where the spec asks for them, such as the monogram shield for a missing photo.
- **Logic is pure and I/O is injected.** Modules in `src/lib/` take inputs and return outputs; the clock, network, audio element, email sender, and Turnstile verifier come in as parameters or adapters, so tests pass fakes.

## React

- **A page passes every content value it shows, metadata included, to `<DraftRibbon uses={…}>`.** A value left out hides its drafts from the preview ribbon.

- **Server Components by default.** `"use client"` goes on the smallest component that needs state, effects, or browser APIs, as far down the tree as it can sit.
- **Components receive what they show.** Copy and data arrive through props from content files or the Feed; a component holds presentation and interaction only.
- **The player store is the only owner of playback.** Archive rows, Episode pages, the Transcript, and the player UI send commands to the store and render its state; only the audio adapter touches the `<audio>` element.
- **Derive during render.** A value computable from props or state is computed where it's used. Effects are for syncing with something outside React (the audio element, `localStorage`, the theme on `<html>`).
- **Semantic HTML first.** Native elements (`button`, `a`, `nav`, `dialog`, headings in order) carry the behaviour; ARIA fills gaps no element covers. Every interactive element is reachable by keyboard and shows focus.
- **Lists are keyed by identity**: a stable id such as the Episode number, never array index.
- **Images go through `next/image` with real dimensions** and alt text that says what the picture shows (for a Fool's painting: who, and what they're doing).
- **A library loads only where it's used.** A client library's provider wraps the sections that need it, never the root layout unless every page does: whatever the layout imports ships on every page and counts against the home page's Lighthouse budget.
- **Animation goes through `MotionProvider`.** Animated sections use `m` components inside `src/components/motion-provider.tsx`, which loads Motion on demand, carries the reduced-motion setting, and applies the shared presets from `src/lib/motion.ts`.
