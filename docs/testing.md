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
| Largest Contentful Paint | ≤ 2.5 s  |
| Cumulative Layout Shift  | ≤ 0.1    |
| Total Blocking Time      | ≤ 200 ms |
| JavaScript               | ≤ 250 KB |
| Images                   | ≤ 300 KB |
| Fonts                    | ≤ 150 KB |
| Everything               | ≤ 800 KB |

Reports are written to `.lighthouseci/reports/` and attached to each CI run as `lighthouse-reports`. They are not uploaded anywhere public.

When a page is added, add its URL to `ci.collect.url` in `lighthouserc.json`.

## Formatting, linting, and types

```bash
npm run format              # fix formatting
npm run format:check        # what CI runs
npm run lint
npm run typecheck
```

The pre-commit hook formats staged files with Prettier, so `format:check` only fails for files committed without the hook.

## In CI

`.github/workflows/ci.yml` runs on every pull request and every push to `main`:

1. **Format, lint, typecheck, unit tests**, with coverage
2. **Build static site**, shared with the next two jobs
3. **Playwright** on Chromium and WebKit, with browsers cached between runs
4. **Lighthouse** with the mobile budget

`.github/workflows/nightly.yml` runs the Playwright suite on Firefox every night, and can be started by hand from the Actions tab.

## Merging

Merge with the helper. It merges only a head commit that has passed review and every check:

```bash
gh pr comment <pr-number> --body "Code review: passed at <full head SHA>"   # after /code-review finds nothing serious
npm run merge -- <pr-number>
```

It waits for pending checks, stops at the first failure, and refuses a pull request with no checks or whose latest passed review names an older commit. Each push after a review needs its own review first (`AGENTS.md`, Merging). `scripts/merge-on-green.sh` has the details.

Visual pull requests also need a Jester's approval of the preview first; see `AGENTS.md`.
