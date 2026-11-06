# Testing

The site is tested in three layers. Each runs locally with one command. In CI, unit tests run on every pull request, and the other two on every one but a docs-only one (In CI, below). Tests are written first, using the `tdd` skill; the seams they sit at are listed under "Testing Decisions" in `docs/spec.md`.

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
- **The player store** is tested, and driven from component tests, with `FakeAudio` (`src/lib/fake-audio.ts`). It copies the `<audio>` element's behaviour that the store depends on; its header lists where it differs.
- **Component tests** assert what a user sees and include an accessibility check:

  ```tsx
  const { container } = render(<Home />);
  expect(await axe(container)).toHaveNoViolations();
  ```

A test that writes to `console.error` or `console.warn` fails (`jest.setup.ts`), since React reports bugs such as an update outside `act()` that way. A test that expects an error stubs it with `jest.spyOn(console, "error").mockImplementation(() => {})`. A component that loads something after rendering (Motion's features under `MotionProvider`) needs that to land inside `act()` before the test checks it, as the style guide test does. A component that renders a `<script>` the browser would run, such as `WebAnalytics`, is tested as built HTML, `renderToStaticMarkup` into a container, as `src/components/web-analytics.test.tsx` does: React warns when the client creates one. A data block (`type="application/ld+json"`, as `JsonLd` renders) draws no warning.

`npm run check` runs ESLint, the type check, and the whole Jest suite. The pre-commit and pre-merge-commit hooks run it, so a commit or merge with a lint error, type error, or failing test is refused, and the pre-push hook refuses a branch missing commits from `origin/main`. Each hook in `.husky/` says why.

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

Specs live in `e2e/`. Every page gets an axe scan (`@axe-core/playwright`) and a no-horizontal-scroll check at phone width. `e2e/sweep.spec.ts` holds what must be true everywhere, on each page in `out/` that search engines may list, and the 404 page, so a new public page or Episode address is swept without being listed: axe in both themes with reduced motion, nothing animating without end under reduced motion, and no overflow at 320 px. It also scans each of the style guide's buttons while hovered, since axe sees only the state a page is in, and the player playing, paused, failed, and offering to resume. To sweep the real content, not the fixture, run `FEED=live npm run build` first; the one check that fails then is the one that the fixture's Bonus and Trailer pages exist. Project names follow `<browser>-<size>`, so `--project=webkit-phone` runs a single combination.

Every build but a deploy reads the fixture feed, `src/content/feed-fixture.xml`, whatever the live feed holds (docs/deploy.md), so tests can count on its Episodes, bonus, trailer, and Transcripts. The site before Episode 1 is published has its own build. `FEED=empty` swaps the Feed for `src/content/feed-fixture-empty.xml`, a channel with no Episodes, and runs only the tests tagged `@empty-feed` (`e2e/coming-soon.spec.ts`), which the normal run leaves out:

```bash
npm run build:empty-feed
npm run test:e2e:empty-feed
npm run build               # before testing the normal site again
```

One spec on its own still needs the variable: `FEED=empty npx playwright test e2e/coming-soon.spec.ts --project='chromium-*'`. Without it, Playwright skips the `@empty-feed` tests and reports "No tests found".

That build is the only check that every route still exports with no Episodes, since a static export refuses a route with no pages (CODING_STANDARDS.md, React).

CI runners are slower than a laptop, so a timing assertion ("finishes at once") first waits for a state that proves the code it times has loaded, such as the first animation completing; otherwise it measures the download, passes locally, and fails in CI. Then it counts rendered frames, not milliseconds: it waits for the thing it times to begin, such as the replayed element mounting, awaits two `requestAnimationFrame`s inside `evaluate`, and measures once. CI's WebKit sometimes renders no frames for most of a second, and Motion applies even an instant reduced-motion value on the next frame, so a short `expect.poll` window flakes there (#60). Likewise, let an opening animation finish before an axe scan, since axe samples colors mid-fade. A reveal on scroll (`whileInView` with `once`) plays only while its element is on screen, so a test holds each element in view until it shows; a quick scroll can pass it before Motion has loaded, and WebKit drops a scroll made while the page is still loading. `reveal()` in `e2e/hero-story.ts` repeats the scroll until the element shows.

Reduced motion sets every element's `transition-duration` to 0.01ms (`globals.css`), and `transition-property` defaults to `all`, so under it any style change starts a transition that `getAnimations()` can catch still running. A test counting an element's animations counts only keyframe ones (`a instanceof CSSAnimation`), as `zooms()` in `e2e/gallery.spec.ts` does; counting them all failed WebKit about one run in twenty (#25).

To test that reduced motion keeps an element from moving, wait until Motion has taken over (`motionLoaded()`), record the element's offset on every frame as it fades in (`offsetsAsItAppears()`), and expect none between its two positions; the same check with motion on finds them, which is the sibling case `CODING_STANDARDS.md` asks for. Checking the transform once the fade has finished passes either way, and so does checking the first visible frame, since Motion snaps the transform a frame after the fade begins (#20).

Playwright's actions (`click`, `scrollIntoViewIfNeeded`) wait for an element to hold still, so one that animates without end, such as a painting band's slow zoom, stalls them until the test times out; scroll it with `locator.evaluate((el) => el.scrollIntoView())`.

Playwright can act before React has hydrated a page, when a field shows but its handlers aren't attached yet; a loaded machine widens that window. Forms are disabled until hydration (`CODING_STANDARDS.md`, React), and Playwright waits for a field to be enabled before it types, so their tests need nothing more. To test that guard, abort the page's scripts so it never hydrates, check a script was in fact aborted, and expect the fields disabled, as "stays disabled until its script runs" in `e2e/speak-freely.spec.ts` does. A Play button waits for the player instead: `startEpisode()` in `e2e/player.ts`.

A test about a page's own content looks inside `page.getByRole("main")`, so the header and footer can change without breaking it: in #117, the footer's new Explore, Listen and Follow headings broke a Gallery test that counted every level-2 heading on the page.

Next renders its route announcer as `role="alert"` on every page, so `page.getByRole("alert")` finds two elements; scope it to the component (`page.getByRole("form").getByRole("alert")`).

Desktop WebKit's Tab moves only between text fields, as Safari does by default, skipping buttons, Radix's checkbox and select triggers included; a keyboard test `focus()`es the control, then presses keys.

To test a page whose scripts fail to load, abort only the scripts (`page.route(/\/_next\/static\/chunks\/.*\.js/, …)`): Next serves the stylesheet from the same folder, so blocking the whole folder also takes away the CSS.

A test that plays an Episode uses the helpers in `e2e/player.ts`: its audio route serves byte ranges, without which Chromium ignores a seek.

CI's Linux runners have no sound card. Firefox then breaks off playback a moment after it starts (`NS_ERROR_DOM_MEDIA_MEDIASINK_ERR` in the trace's console), so the player shows its failure and any test still looking for Pause fails, though the audio did play. `nightly.yml` gives it a silent PulseAudio sink. A player test that fails only on Firefox in CI and passes locally: check there first.

Browsers report a failed `<audio>` differently: Chromium fires `error` and then `pause`, while Firefox and WebKit fire only `error`, and `audio.paused` can stay false after one. To test a failure, check what the player shows, not `audio.paused`. `FakeAudio` copies Chromium's order, the harder of the two for the store.

Sessions on this machine build and test in parallel. Each worktree serves its build on its own port (derived from its path in `playwright.config.ts`), and a run fails if that port is taken rather than testing whatever already listens there; stop the stray server (`lsof -nP -iTCP:<port> -sTCP:LISTEN`) and rerun. When tests a change didn't touch time out locally, check `uptime` before suspecting the code: a load average far above the core count slows every browser.

A scheduled Nightly that fails opens an issue titled "Nightly is failing", or comments on the one still open, naming each failed test and the run. `npm run report-nightly -- --dry-run` prints what it would say for the newest failed run.

On each pull request that builds, `npm run dropped-tests` adds a `::warning::` naming any browser test the base has and the head doesn't. It needs `out/`; a rename shows as a drop too.

When a run fails in CI, the HTML report is attached to the workflow run as `playwright-report`. A failure that won't reproduce locally is usually timing: `gh run download <run-id> -n playwright-report -D playwright-report/<run-id>` (git ignores the folder, and a download refuses to overwrite an earlier one), then run `npm run trace -- playwright-report/<run-id>/data/<hash>.zip` on the failing test's trace (one zip per failure; the first line printed names the test, its browser and its viewport, or says it names no test, as when the test opened no browser) to see what loaded around the failing step. It prints one timeline: each step and page action with its start, end and error, console messages, page errors, failed requests, and screencast frames with the gap since the last one. Each frame row gives the path of its image, unzipped to a temporary folder, so open the frames around the failing step.

## Performance (Lighthouse CI)

Lighthouse runs against the built site with its default mobile emulation (a mid-range phone on a throttled connection), three times per page.

```bash
npm run build
npm run lighthouse
npm run lighthouse -- /styleguide/paintings.html   # only the pages named
```

The budget lives in `lighthouserc.json`. Each figure is asserted on its median across the three runs (`aggregationMethod: "median"`), and the run fails if any of these is exceeded. Lighthouse CI's default asserts on the best run, which let #14's preview pass with two of its three runs over budget.

| Measure                  | Budget                                    |
| ------------------------ | ----------------------------------------- |
| Performance score        | ≥ 0.90                                    |
| Accessibility score      | ≥ 0.95                                    |
| Largest Contentful Paint | ≤ 3.2 s, or ≤ 3.6 s on four pages (below) |
| Cumulative Layout Shift  | ≤ 0.1                                     |
| Total Blocking Time      | ≤ 200 ms                                  |
| JavaScript               | ≤ 250 KB                                  |
| Images                   | ≤ 300 KB                                  |
| Fonts                    | ≤ 150 KB                                  |
| Everything               | ≤ 800 KB                                  |
| LCP image discovery      | loaded eagerly, at high priority          |

The four pages on 3.6 s are `/`, `/gallery.html`, `/styleguide/paintings.html`, and `/styleguide/home/simple.html`: CI's runs swing them across 3.2 s on unchanged bytes. Text-led pages keep 3.2 s. Lighthouse's LCP discovery check (`lcp-discovery-insight`, asserted for every page) fails a page whose largest paint is an image that loads lazily or without `fetchpriority="high"`; a page whose largest paint is text isn't checked.

Locally, `/` measures about 3.2 s on main's own unchanged build, and CI's first run of it is always cold, so judge a change to `/` by the early bytes `lighthouse:compare` prints, not by its simulated time.

Why each budget sits where it does, with the measurements behind every change to it: `docs/lighthouse-history.md`. Read it before changing a budget.

`lighthouserc.json` sets the two budgets in its `assertMatrix`. One entry carries every other assertion for every page. The two LCP entries share one URL pattern, the second negated, so a page added later takes 3.2 s unless it joins the pattern. A unit test (`src/lib/lighthouse.test.ts`) fails if any page matches both LCP entries or neither, and the summary's "near the LCP budget" mark measures each page against its own budget.

Before pushing a change to the header, the footer, the root layout, or the first screen of a page, compare it with main: everything those fetch counts against every page's largest paint. A change only to copy, under 200 characters a page, is exempt (`CODING_STANDARDS.md`, Performance). It measures this checkout as it stands, uncommitted changes included. It builds both sides, which takes several minutes, so run it in the background.

```bash
npm run lighthouse:compare              # every budgeted page, against origin/main
npm run lighthouse:compare -- /styleguide/home/simple.html   # only the pages named
npm run lighthouse:compare -- <base-ref> [<page>...]
```

It prints each page's simulated and observed LCP and FCP beside the base, with the bytes of each resource type requested before the observed paint, exact to the byte, and the early files that changed. A file that kept its name, such as the page's own document, shows its bytes on each side. A bundler renames a file whose contents change, so each side also lists the files only it fetched, by name and size, and the stylesheet that grew shows as one name on each side. Those bytes are what the simulated figures track: a page that really paints in 40 ms still scores its LCP from everything it fetched by then, so trim early bytes rather than chase the paint. It also names each font file fetched before the paint, so an unexpected one shows by name rather than hiding in the total, and each page's LCP element: an image paints only after its own request on top of those bytes, so an image-led page sits higher than a text-led one with the same early bytes. A page the base doesn't have yet, such as a new one, shows "–" on the base's side.

After the figures, it prints the stylesheet rules that changed, as a diff of each page's early stylesheets (formatted, since the bundler renames a changed file), each distinct change once under the pages it reached. A utility new to the stylesheet every page loads shows there by name, such as `+ .w-40 { width: calc(var(--spacing) * 40); }` for the About page's first portrait width in #26, which then moved to `w-48`, a width the site already compiled.

Locally, a page's simulated LCP varies by up to half a second between runs of the same build as the machine's load changes, while its early bytes don't: `/` measured 3.06 s and then 2.56 s from identical bytes in #20. Judge a change with `lighthouse:compare`, which measures both checkouts under the same load, and read its early bytes before its simulated times.

A simulated time moves in steps of about one round trip (roughly 150 ms), not smoothly, so a page just under its budget can cross it on a few hundred extra bytes, and the same bytes then fail on most runs. The summary marks a page "near the LCP budget" when any run lands within one step of it, listing every run: the median alone hides a page that crosses on one run in three. To find which bytes tipped it, read which early type grew and which files differ in `lighthouse:compare`, then build once without the suspect component and measure that page alone (`npm run lighthouse -- <page>`). In #19, the player dock in the root layout was handed the whole Episode-page copy for three labels: 1 KB more document on every page took the simple home mockup from 3.05 s to 3.20 s. In #23, the Transcript's Tailwind mask and transition utilities grew the stylesheet every page loads by 373 bytes; main's own CI runs of that mockup landed at 2.63, 3.30 and 2.64 s, and the PR's two runs in three over 3.2 s failed it.

A Server Component's markup reaches the page twice: in its HTML, and again in the data React reads to take the page over. So whatever the header or footer draws inline is paid twice on every page. In #117, the Amazon Music wordmark's 6.8 KB outline, drawn inline in the footer, added 5 to 6.5 KB to every page's early document, and the simulated LCP of six pages rose about 150 ms. It now lives in `public/icons/` as a symbol, drawn with `<use>`, and `src/components/mark.test.ts` fails on any outline drawn inline past 2,500 characters. To estimate a page's document before a full comparison, gzip it from the build on each side: `gzip -c out/404.html | wc -c`.

After the run, `npm run lighthouse` prints each page's median figures: simulated and observed LCP and FCP, the bytes of each type fetched before the paint, each early font file by name, the LCP element (and the file it waited on, when it is an image), and any page near the LCP budget (`scripts/lighthouse-summary.ts`, its logic in `src/lib/lighthouse.ts`). Reports are written to `.lighthouseci/reports/` and attached to each CI run as `lighthouse-reports`. They are not uploaded anywhere public. To read CI's figures, download them and summarise them in the same way:

```bash
gh run download <run-id> -n lighthouse-reports -D /tmp/lh
npx tsx scripts/lighthouse-summary.ts "CI=/tmp/lh"
```

To see how far each page moves between CI runs, which is what a budget has to hold, read the spread across main's recent runs:

```bash
npm run lighthouse:spread        # main's last 10 CI runs
npm run lighthouse:spread -- 30  # its last 30, as far back as CI keeps reports (14 days)
```

It prints each page's range of medians and of single runs, with the range of its early bytes beside them: a page whose bytes moved swung for a reason, not on noise.

To show that a budget still catches a regression, measure main's own build with one file made heavier. `gh run download <run-id> -n site -D out` puts a CI run's build in `out/` without building, for a run of the last day: CI keeps `site` for one day, the reports for 14. The summary's LCP element line names the image the largest paint waited on; append incompressible bytes to it (`head -c 200000 /dev/urandom >> out/<that file>`, never zeros, which the Lighthouse server's gzip shrinks to nothing) and run `npm run lighthouse -- <page>`.

When a page is added, add its URL to `ci.collect.url` in `lighthouserc.json`. If CI's runs of it then swing across 3.2 s on unchanged bytes, as the pages above did, add its path to their pattern in both LCP entries and its budget to the unit test.

## Images

Every image the content shows is a file under `public/` with its pixel size in the content record; `npm run images` (run by `build` and `dev`, `scripts/images.ts`) makes its responsive set in `public/images/`, AVIF and WebP at each width next/image asks for, plus a portrait crop around a painting's focal point for phones. It fails the build if a file is missing or its size doesn't match the content. A phone downloads 30 to 60 KB per painting at Lighthouse's emulated screen and up to about 150 KB on a 3× screen; the encoding settings in `src/lib/phone-budget.ts` are tuned for that, and the build fails if a painting's AVIF a phone would fetch passes 180 KB, naming every painting over it at once. "Phone" there means one held upright, up to 430 CSS px wide; turned sideways it gets the desktop layout and larger files, which aren't checked.

Making them takes about 13 minutes on a CI runner, so every job that builds restores them first (`.github/actions/image-cache`). `scripts/images.ts` stamps each folder with what made it (the source, the plan, sharp's version, and the contents of `scripts/images.ts` and `src/lib/phone-budget.ts`) and remakes and rechecks any that differ, so an old cache can't ship a stale image or slip past the phone budget.

To add a public-domain painting, `npm run add-painting -- "<File:… or its Commons page address>" <slug> [--detail l,t,w,h]` saves it to `public/paintings/` and prints its entry for `src/content/paintings.ts`; the build fails until its alt text, medium, collection, and focal point are written. It also writes a copy ruled in tenths to read the focal point off, and estimates what a phone would download. A sheet or print whose paper grain or hatching puts it over budget can keep just its subject with `--detail left,top,width,height` (fractions of the file), as #25 did for Holbein's Folly; the entry records the cut.

## Fonts

The three typefaces are self-hosted from `src/fonts/`, each face split in two the way Google Fonts splits a family: a subset holding Google's latin subset plus the accented letters the content uses (the ń of Stańczyk), and a rest file holding every other glyph the typeface has. Each declares its unicode-range, so a page fetches a rest file only when it shows a letter the subset lacks, such as one in an episode title from the feed.

```bash
npm run fonts
```

`scripts/fonts.ts` downloads the upstream files from a fixed commit of google/fonts, cuts both halves of each face, and writes `src/fonts/` and `src/app/fonts.ts`: next/font reads only literal options, so the definitions are generated, and the script, not that file, is the one to edit. Its output is the same on every run until the content's letters change. Content with a letter the subsets lack fails the content test ("sets every letter in the self-hosted font subsets"); run `npm run fonts` and commit what it changes. `e2e/fonts.spec.ts` checks that a page naming Fools fetches no rest file, and that their accented letters set in the brand faces.

## Formatting, linting, and types

```bash
npm run format              # fix formatting
npm run format:check        # what CI runs
npm run lint
npm run typecheck
npm run lint:workflows      # actionlint on .github/workflows, as CI's Lint workflows job runs it
```

`lint` and `typecheck` both run `next typegen` first: type-aware lint rules need the generated `next-env.d.ts` (gitignored), which types imports such as `import logo from "….webp"`.

The pre-commit hook formats staged files with Prettier, so `format:check` only fails for files committed without the hook.

`lint:workflows` (`scripts/actionlint.sh`) downloads the actionlint release CI pins, once, into `node_modules/.cache`. It runs shellcheck on every `run:` block only when shellcheck is installed, and says so when it isn't; CI's image has it. Nothing runs it on commit (#44), so run it before pushing a workflow change.

`lint:shell` runs shellcheck on `scripts/*.sh`, which actionlint doesn't reach, failing on warnings and errors: its `info` notes here are single-quoted scripts and functions it can't see called. CI's **Lint workflows** job runs it; locally it needs shellcheck installed.

A shell script with logic is tested from a `scripts/*.test.ts` that runs it for real: `merge-holds-branch.test.ts` against a throwaway repo, `smoke-check.test.ts` with stubs for `curl` and `sleep` on the `PATH`.

## In CI

`.github/workflows/ci.yml` runs on every pull request and every push to `main`:

1. **Lint workflows** (actionlint, as `npm run lint:workflows`, and shellcheck, as `npm run lint:shell`)
2. **Format, lint, typecheck, unit tests**, with coverage
3. **Build static site**, shared with the jobs that test it
4. **Playwright** on Chromium and WebKit, with browsers cached between runs, and the coming-soon journey against its own build from the empty feed
5. **Lighthouse** with the mobile budget
6. **Dropped browser tests**, on pull requests only: warns, without failing, when one removes or renames a browser test

A pull request changing only `docs/**` or top-level `*.md` is **docs-only** (`scripts/docs-only.sh`): it runs jobs 1 and 2 and skips the rest, along with its preview, because no build step or browser test reads those files. The whole PR is judged on each push, and a PR that also changes anything else runs every job. Main's required checks count a skipped job as passed, and `npm run merge` merges it as usual. A push to `main` always builds and runs the browser and Lighthouse jobs. If a test or build step starts reading a file under `docs/` or top-level Markdown, change the script's patterns with it; until then, a docs-only PR that breaks it first fails after merging, on that push's CI run (and its deploy, for a build step).

`.github/workflows/nightly.yml` runs the Playwright suite on Firefox every night, and can be started by hand from the Actions tab. A pull request that changes its failure report previews it against the newest failed run.

Two more run on every push to `main`:

- **Merge audit** (`merge-audit.yml`, `scripts/audit-merge.sh`) fails when the commit came from a PR with neither a `Code review: passed at <head>` comment nor the `ready-for-human` label. Nothing on GitHub requires the review comment, so this makes a merge without one loud after the fact.
- **Conflict watch** (`conflict-watch.yml`, `scripts/flag-conflicts.sh`) comments on each open `ready-for-human` PR that no longer merges cleanly with main, and removes the comment once a push to that PR resolves it. GitHub skips pull-request runs while a PR conflicts, so only pushes to `main` can add the comment.

## Merging

Every pull request is reviewed before it merges or goes to a Jester (`AGENTS.md`, Merging). Merge with the helper. It merges only a head commit that has passed review and every check:

```bash
npm run review-passed -- <pr-number> <reviewed full SHA>   # after review finds nothing serious
npm run merge -- <pr-number>
```

It waits for checks to appear after a push and for pending ones to finish, stops at the first failure or as soon as the PR conflicts with main, and refuses a pull request whose checks never appear or whose latest passed review names an older commit. Once the checks pass, it also refuses if main has meanwhile gained commits in the PR's files (`scripts/main-overlap.sh`), listing them; read them, then rerun with the `--overlap-read <sha>` it prints, or merge `origin/main` in and review again. Each push after a review needs its own review first (`AGENTS.md`, Merging). `scripts/merge-on-green.sh` has the details.

Visual pull requests go to a Jester instead: `npm run mark-ready -- <pr-number>` refuses a head without a passed review, as `merge` does (`scripts/require-review.sh`), then labels it once its checks and preview pass. See `AGENTS.md`.
