# Testing

The site is tested in three layers. Each runs locally with one command and in CI on every pull request. Tests are written first, using the `tdd` skill; the seams they sit at are listed under "Testing Decisions" in `docs/spec.md`.

## Before you start

```bash
npm install
npx playwright install chromium webkit   # once, and after Playwright upgrades
```

Add `firefox` to that install if you want to run the nightly browser locally.

## Unit and component tests (Jest)

Jest uses Next's preset (`next/jest`), React Testing Library, and jest-axe. Test files sit next to the code they test, named `*.test.ts` or `*.test.tsx`.

```bash
npm test                    # run once
npm run test:watch          # rerun on change
npm run test:coverage       # with coverage, as CI runs it
npx jest src/lib            # one folder or file
```

- **Logic modules** live in `src/lib/`. Coverage there must stay at or above 90% of lines, or `test:coverage` fails.
- **Component tests** assert what a user sees and include an accessibility check:

  ```tsx
  const { container } = render(<Home />);
  expect(await axe(container)).toHaveNoViolations();
  ```

The pre-commit hook runs ESLint, the type check, and the whole Jest suite, so a commit with a lint error, type error, or failing test is refused.

### Dependencies that ship only as ES modules

Jest loads code as CommonJS and doesn't transform `node_modules`, so a package published only as ES modules fails at import with `SyntaxError: Cannot use import statement outside a module` (or `Unexpected token 'export'`), even though `next build` works. The fix is to list the package in `transpilePackages` in `next.config.ts` (add the option if it isn't there yet), which `next/jest` also reads. List the ES-module-only packages it imports too: the error names one package at a time, so rerun Jest until it passes, and leave a comment saying which module needs them.

## Browser tests (Playwright)

Playwright drives the **built static site** in `out/`, served the same way the host serves it, never the dev server. Build first:

```bash
npm run build
npm run test:e2e            # Chromium and WebKit, phone and desktop
npm run test:e2e:firefox    # Firefox, phone and desktop (nightly in CI)
npx playwright test --ui    # interactive runner
```

Specs live in `e2e/`. Every page should get an axe scan (`@axe-core/playwright`) and a no-horizontal-scroll check at phone width. Project names follow `<browser>-<size>`, so `--project=webkit-phone` runs a single combination.

CI runners are slower than a laptop, so a timing assertion ("finishes within 300 ms") first waits for a state that proves the code it times has loaded, such as the first animation completing. Otherwise it measures the download, passes locally, and fails in CI. Likewise, let an opening animation finish before an axe scan, since axe samples colors mid-fade.

When a run fails in CI, the HTML report is attached to the workflow run as `playwright-report`.

## Performance (Lighthouse CI)

Lighthouse runs against the built site with its default mobile emulation (a mid-range phone on a throttled connection), three times per page.

```bash
npm run build
npm run lighthouse
```

The budget lives in `lighthouserc.json`. The run fails if any of these is exceeded:

| Measure                  | Budget   |
| ------------------------ | -------- |
| Performance score        | ≥ 0.90   |
| Accessibility score      | ≥ 0.95   |
| Largest Contentful Paint | ≤ 3.2 s  |
| Cumulative Layout Shift  | ≤ 0.1    |
| Total Blocking Time      | ≤ 200 ms |
| JavaScript               | ≤ 250 KB |
| Images                   | ≤ 300 KB |
| Fonts                    | ≤ 150 KB |
| Everything               | ≤ 800 KB |

The Largest Contentful Paint budget was 2.5 s until the site shell (#12) arrived. Lighthouse simulates a throttled load from every byte requested before the first paint, and the header's script plus the UI typeface on every page put the bare home page at a steady 2.75 s (it paints in about 40 ms unthrottled). Menu code, a smaller logo, and a single UI weight didn't move that figure, so the budget moved to 3.0 s.

It rose to 3.2 s with the painting pipeline (#13). A page whose largest paint is an image waits behind the same early bytes, plus the image's own request: the paintings page (`/styleguide/paintings`, a band on the first screen and framed paintings below) simulates at 3.05 s, and still at 2.9 s with its band swapped for a 2 KB file, so the floor comes from the shell, not the painting. Every Fools' Gallery page has that shape. Text-led pages sit lower (the home page is at 2.6 s). Revisit it at the home page mockup gate (#14), which is the place to trim the shell's early script.

### Images

Every image the content shows is a file under `public/` with its pixel size in the content record; `npm run images` (run by `build` and `dev`, `scripts/images.ts`) makes its responsive set in `public/images/`, AVIF and WebP at each width next/image asks for, plus a portrait crop around a painting's focal point for phones. It fails the build if a file is missing or its size doesn't match the content. A phone downloads 30 to 60 KB per painting at Lighthouse's emulated screen and up to about 150 KB on a 3× screen; the encoding settings in `scripts/images.ts` are tuned for that.

When a change moves a budget, compare it with main:

```bash
npm run lighthouse:compare              # or: -- <base-ref>
```

It prints each page's simulated and observed LCP and FCP beside the base, with the bytes of each resource type requested before the observed paint. Those bytes are what the simulated figures track: a page that really paints in 40 ms still scores its LCP from everything it fetched by then, so trim early bytes rather than chase the paint.

Reports are written to `.lighthouseci/reports/` and attached to each CI run as `lighthouse-reports`. They are not uploaded anywhere public.

When a page is added, add its URL to `ci.collect.url` in `lighthouserc.json`.

## Formatting, linting, and types

```bash
npm run format              # fix formatting
npm run format:check        # what CI runs
npm run lint
npm run typecheck
```

`lint` and `typecheck` both run `next typegen` first: type-aware lint rules need the generated `next-env.d.ts` (gitignored), which types imports such as `import logo from "….webp"`.

The pre-commit hook formats staged files with Prettier, so `format:check` only fails for files committed without the hook.

## In CI

`.github/workflows/ci.yml` runs on every pull request and every push to `main`:

1. **Format, lint, typecheck, unit tests**, with coverage
2. **Build static site**, shared with the next two jobs
3. **Playwright** on Chromium and WebKit, with browsers cached between runs
4. **Lighthouse** with the mobile budget

`.github/workflows/nightly.yml` runs the Playwright suite on Firefox every night, and can be started by hand from the Actions tab.

Two more run on every push to `main`:

- **Merge audit** (`merge-audit.yml`, `scripts/audit-merge.sh`) fails when the commit came from a PR with neither a `Code review: passed at <head>` comment nor the `ready-for-human` label. GitHub Free can't block such a merge, so this makes it loud after the fact.
- **Conflict watch** (`conflict-watch.yml`, `scripts/flag-conflicts.sh`) comments on each open `ready-for-human` PR that no longer merges cleanly with main, and removes the comment once a push to that PR resolves it. GitHub skips pull-request runs while a PR conflicts, so only pushes to `main` can add the comment.

## Merging

Merge with the helper. It merges only a head commit that has passed review and every check:

```bash
npm run review-passed -- <pr-number> <reviewed full SHA>   # after /code-review finds nothing serious
npm run merge -- <pr-number>
```

It waits for pending checks, stops at the first failure, and refuses a pull request with no checks or whose latest passed review names an older commit. Each push after a review needs its own review first (`AGENTS.md`, Merging). `scripts/merge-on-green.sh` has the details.

Visual pull requests also need a Jester's approval of the preview first; see `AGENTS.md`.
