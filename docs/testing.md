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

Specs live in `e2e/`. Every page should get an axe scan (`@axe-core/playwright`) and a no-horizontal-scroll check at phone width. Project names follow `<browser>-<size>`, so `--project=webkit-phone` runs a single combination.

Every build but a deploy reads the fixture feed, `src/content/feed-fixture.xml`, whatever the live feed holds (docs/deploy.md), so tests can count on its Episodes, bonus, trailer, and Transcripts. The site before Episode 1 is published has its own build. `FEED=empty` swaps the Feed for `src/content/feed-fixture-empty.xml`, a channel with no Episodes, and runs only the tests tagged `@empty-feed` (`e2e/coming-soon.spec.ts`), which the normal run leaves out:

```bash
npm run build:empty-feed
npm run test:e2e:empty-feed
npm run build               # before testing the normal site again
```

That build is the only check that every route still exports with no Episodes, since a static export refuses a route with no pages (CODING_STANDARDS.md, React).

CI runners are slower than a laptop, so a timing assertion ("finishes at once") first waits for a state that proves the code it times has loaded, such as the first animation completing; otherwise it measures the download, passes locally, and fails in CI. Then it counts rendered frames, not milliseconds: it waits for the thing it times to begin, such as the replayed element mounting, awaits two `requestAnimationFrame`s inside `evaluate`, and measures once. CI's WebKit sometimes renders no frames for most of a second, and Motion applies even an instant reduced-motion value on the next frame, so a short `expect.poll` window flakes there (#60). Likewise, let an opening animation finish before an axe scan, since axe samples colors mid-fade. A reveal on scroll (`whileInView` with `once`) plays only while its element is on screen, so a test holds each element in view until it shows; a quick scroll can pass it before Motion has loaded, and WebKit drops a scroll made while the page is still loading. `reveal()` in `e2e/hero-story.ts` repeats the scroll until the element shows.

Reduced motion sets every element's `transition-duration` to 0.01ms (`globals.css`), and `transition-property` defaults to `all`, so under it any style change starts a transition that `getAnimations()` can catch still running. A test counting an element's animations counts only keyframe ones (`a instanceof CSSAnimation`), as `zooms()` in `e2e/gallery.spec.ts` does; counting them all failed WebKit about one run in twenty (#25).

To test that reduced motion keeps an element from moving, wait until Motion has taken over (`motionLoaded()`), record the element's offset on every frame as it fades in (`offsetsAsItAppears()`), and expect none between its two positions; the same check with motion on finds them, which is the sibling case `CODING_STANDARDS.md` asks for. Checking the transform once the fade has finished passes either way, and so does checking the first visible frame, since Motion snaps the transform a frame after the fade begins (#20).

Playwright's actions (`click`, `scrollIntoViewIfNeeded`) wait for an element to hold still, so one that animates without end, such as a painting band's slow zoom, stalls them until the test times out; scroll it with `locator.evaluate((el) => el.scrollIntoView())`.

Playwright can act before React has hydrated a page, when a field shows but its handlers aren't attached yet; a loaded machine widens that window. Forms are disabled until hydration (`CODING_STANDARDS.md`, React), and Playwright waits for a field to be enabled before it types, so their tests need nothing more. To test that guard, abort the page's scripts so it never hydrates, check a script was in fact aborted, and expect the fields disabled, as "stays disabled until its script runs" in `e2e/speak-freely.spec.ts` does. A Play button waits for the player instead: `startEpisode()` in `e2e/player.ts`.

Next renders its route announcer as `role="alert"` on every page, so `page.getByRole("alert")` finds two elements; scope it to the component (`page.getByRole("form").getByRole("alert")`).

Desktop WebKit's Tab moves only between text fields, as Safari does by default, skipping buttons, Radix's checkbox and select triggers included; a keyboard test `focus()`es the control, then presses keys.

To test a page whose scripts fail to load, abort only the scripts (`page.route(/\/_next\/static\/chunks\/.*\.js/, …)`): Next serves the stylesheet from the same folder, so blocking the whole folder also takes away the CSS.

A test that plays an Episode uses the helpers in `e2e/player.ts`: its audio route serves byte ranges, without which Chromium ignores a seek.

Sessions on this machine build and test in parallel. Each worktree serves its build on its own port (derived from its path in `playwright.config.ts`), and a run fails if that port is taken rather than testing whatever already listens there; stop the stray server (`lsof -nP -iTCP:<port> -sTCP:LISTEN`) and rerun. When tests a change didn't touch time out locally, check `uptime` before suspecting the code: a load average far above the core count slows every browser.

When a run fails in CI, the HTML report is attached to the workflow run as `playwright-report`. A failure that won't reproduce locally is usually timing: `gh run download <run-id> -n playwright-report` and open the failing test's trace (`npx playwright show-trace <trace>.zip`) to see what loaded around the failing step.

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

The Largest Contentful Paint budget was 2.5 s until the site shell (#12) arrived. Lighthouse simulates a throttled load from every byte requested before the first paint, and the header's script plus the UI typeface on every page put the bare home page at a steady 2.75 s (it paints in about 40 ms unthrottled). Menu code, a smaller logo, and a single UI weight didn't move that figure, so the budget moved to 3.0 s.

It rose to 3.2 s with the painting pipeline (#13). A page whose largest paint is an image waits behind the same early bytes, plus the image's own request: the paintings page (`/styleguide/paintings`, a band on the first screen and framed paintings below) simulates at 3.05 s, and still at 2.9 s with its band swapped for a 2 KB file, so the floor comes from the shell, not the painting. Every Fools' Gallery page has that shape. Text-led pages sit lower (the 404 page is at 2.6 s). The home page rose from 2.6 s to 2.98 s when its largest paint became the logo above the intro (#55). The home page mockup (#14, `/styleguide/home`) was over the budget: 2.72, 3.49, and 3.50 s in CI with the reveal hero, and locally a median of 3.43 s with the simple hero and 3.73 s with the reveal, against 2.9 s for the bare home page. Two things cost it:

- **Extended-Latin fonts (#57).** "Stańczyk" in the Gallery teaser and on his placard pulled in Google's latin-ext files of the body face (41 KB) and the UI face (10 KB): fonts went from 83 KB to 135 KB, and first paint from 1.05 s to 1.5 s. The fonts are now self-hosted subsets that carry the ń (see Fonts below). Measured locally against main, medians of three runs:

  | Page                               | Before               | After               |
  | ---------------------------------- | -------------------- | ------------------- |
  | `/styleguide/home/simple` (mockup) | 3.43 s, fonts 135 KB | 3.05 s, fonts 79 KB |
  | `/styleguide/home` (reveal hero)   | 3.73 s               | 3.35 s              |
  | `/styleguide/paintings` (Stańczyk) | 3.05 s, fonts 95 KB  | 2.90 s, fonts 79 KB |
  | `/`                                | 2.90 s, fonts 85 KB  | 2.90 s, fonts 79 KB |
  | `/404`                             | 2.60 s, fonts 85 KB  | 2.52 s, fonts 79 KB |

  The simple mockup is back in `lighthouserc.json`. That left the reveal hero over the budget by Motion alone, until #20 (below).

- **Motion, for the reveal hero (52 KB of script, about 0.3 s).** The home page (#20) uses the reveal, so `HeroReveal` draws the story hidden without Motion and loads Motion in its own chunk once React is running, after the first paint. That took `/` from 3.35 s to between 2.56 s and 3.06 s locally (medians of three, across runs), with early script from 212 KB to 161 KB. The preview pages share `HeroReveal`, so `/styleguide/home` gains the same.

It rose to 3.6 s on the three pages CI's runs swing on (#89): `/gallery.html`, `/styleguide/paintings.html`, and `/styleguide/home/simple.html`. On those pages the runner, not the bytes, decides which step a run lands on. From the gallery's first painting growing on main (02:00 UTC on 31 October) to the end of 1 November, 17 CI runs on main and on PRs moved those pages' bytes by no more than 3 KB. Across them, the simple mockup's median of three landed between 2.63 and 3.28 s (single runs 2.41 to 3.32 s), the paintings page's between 2.34 and 3.02 s (runs up to 3.17 s), and the gallery's between 2.95 and 3.03 s. #90, which changed no byte the site serves, then measured medians of 3.31 s on the gallery and the simple mockup, with a run at 3.37 s, and failed against 3.2 s. Trimming a step (about 150 ms) of early bytes can't clear a swing of 700 ms. The performance score held at 0.92 or above on every one of those runs, so only the LCP budget failed on noise.

Text-led pages keep 3.2 s: they hold lower and steadier, with no median above 2.78 s and no run above 3.10 s.

`/` kept 3.2 s at first: it paints the same logo as the simple mockup from much the same bytes, yet its median stayed between 2.42 and 2.79 s. It joined the 3.6 s pages in #89's retro, when #97, which left its early bytes where main's own runs put them (383,111 against 383,085 to 383,109), failed it with runs of 3,967, 3,322 and 2,569 ms. `/` is the first page each CI run measures, so one of its three runs is always cold (3.9 to 4.6 s), and one more slow run moves its median over: a median of three outvotes one run, not two. Locally, three runs of `/` on main's build on 1 November each measured 3,203 ms, over 3.2 s by a few milliseconds, as they did before #89. The budget follows CI, so judge a local change to `/` with `lighthouse:compare`.

3.6 s was the highest median CI had produced on unchanged bytes (3.31 s) plus two steps, so noise alone would have to land a page two steps above anything seen by then. `/` has since reached 3.32 s, 280 ms under it, just short of two steps. A real regression of early bytes still fails, as the simulated paint grows by about 1 s for every 200 KB fetched before it. Padding the simple mockup's logo with 100, 200, and 300 KB of incompressible bytes moved its local median from 3.20 s to 3.68, 4.20, and 4.65 s, and about 270 KB more in the gallery's largest early script moved the gallery's from 2.90 to 4.34 s. From the simple mockup's fastest medians it lands on the edge: about 3.63 s from 2.63 s, and about 3.56 s from the 2.56 s that runs just before 31 October, 02:00 UTC, measured on the same bytes. 300 KB clears it from any of them. On `/`, whose medians reach down to 2.42 s, 200 KB more lands near 3.4 s and passes; 300 KB fails. Images have their own byte budget of 300 KB, which catches 200 KB more on the simple mockup and the paintings page (115 and 109 KB of images now), but on the gallery (80 KB) only past 220 KB more.

Five runs instead of three were the other way to steady the median. Resampling the same runs, they halve how often the simple mockup's median crosses 3.2 s (from about one CI run in ten to one in twenty) without ending it, and add about 2.5 minutes to every CI run.

The gallery's first painting was lazy-loaded until #89's retro, and Lighthouse's simulation didn't hold the paint for it: the gallery's LCP didn't move when that painting grew by 300 KB. Loaded at high priority (`loading="largest-paint"`), it does. `lighthouse:compare` against main showed the same early bytes on both sides (the painting was fetched before the paint either way; the document is 9 bytes larger for the attribute), and the gallery's simulated LCP rose from 2.90 to 3.13 s. 200 KB more on the painting then took it to 4.13 s. Locally that rise would have left the gallery's slowest CI median (#90's 3.31 s, about 3.54 s with the rise) under half a step from 3.6 s. CI didn't show the rise: the first CI run with the painting loaded first measured the gallery at a median of 2.64 s, below its earlier 2.95 to 3.03 s, so it keeps 3.6 s. Watch it with `npm run lighthouse:spread` (below). Lighthouse's LCP discovery check (`lcp-discovery-insight`, asserted for every page) fails a page whose largest paint is an image that loads lazily or without `fetchpriority="high"`; a page whose largest paint is text isn't checked.

`lighthouserc.json` sets the two budgets in its `assertMatrix`. One entry carries every other assertion for every page. The two LCP entries share one URL pattern, the second negated, so a page added later takes 3.2 s unless it joins the pattern. A unit test (`src/lib/lighthouse.test.ts`) fails if any page matches both LCP entries or neither, and the summary's "near the LCP budget" mark measures each page against its own budget.

Before pushing a change to the header, the footer, the root layout, or the first screen of a page, compare it with main: everything those fetch counts against every page's largest paint.

```bash
npm run lighthouse:compare              # every budgeted page, against origin/main
npm run lighthouse:compare -- /styleguide/home/simple.html   # only the pages named
npm run lighthouse:compare -- <base-ref> [<page>...]
```

It prints each page's simulated and observed LCP and FCP beside the base, with the bytes of each resource type requested before the observed paint, exact to the byte, and the early files that changed. A file that kept its name, such as the page's own document, shows its bytes on each side. A bundler renames a file whose contents change, so each side also lists the files only it fetched, by name and size, and the stylesheet that grew shows as one name on each side. Those bytes are what the simulated figures track: a page that really paints in 40 ms still scores its LCP from everything it fetched by then, so trim early bytes rather than chase the paint. It also names each font file fetched before the paint, so an unexpected one shows by name rather than hiding in the total, and each page's LCP element: an image paints only after its own request on top of those bytes, so an image-led page sits higher than a text-led one with the same early bytes. A page the base doesn't have yet, such as a new one, shows "–" on the base's side.

After the figures, it prints the stylesheet rules that changed, as a diff of each page's early stylesheets (formatted, since the bundler renames a changed file), each distinct change once under the pages it reached. A utility new to the stylesheet every page loads shows there by name, such as `+ .w-40 { width: calc(var(--spacing) * 40); }` for the About page's first portrait width in #26, which then moved to `w-48`, a width the site already compiled.

Locally, a page's simulated LCP varies by up to half a second between runs of the same build as the machine's load changes, while its early bytes don't: `/` measured 3.06 s and then 2.56 s from identical bytes in #20. Judge a change with `lighthouse:compare`, which measures both checkouts under the same load, and read its early bytes before its simulated times.

A simulated time moves in steps of about one round trip (roughly 150 ms), not smoothly, so a page just under its budget can cross it on a few hundred extra bytes, and the same bytes then fail on most runs. The summary marks a page "near the LCP budget" when any run lands within one step of it, listing every run: the median alone hides a page that crosses on one run in three. To find which bytes tipped it, read which early type grew and which files differ in `lighthouse:compare`, then build once without the suspect component and measure that page alone (`npm run lighthouse -- <page>`). In #19, the player dock in the root layout was handed the whole Episode-page copy for three labels: 1 KB more document on every page took the simple home mockup from 3.05 s to 3.20 s. In #23, the Transcript's Tailwind mask and transition utilities grew the stylesheet every page loads by 373 bytes; main's own CI runs of that mockup landed at 2.63, 3.30 and 2.64 s, and the PR's two runs in three over 3.2 s failed it.

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
```

`lint` and `typecheck` both run `next typegen` first: type-aware lint rules need the generated `next-env.d.ts` (gitignored), which types imports such as `import logo from "….webp"`.

The pre-commit hook formats staged files with Prettier, so `format:check` only fails for files committed without the hook.

## In CI

`.github/workflows/ci.yml` runs on every pull request and every push to `main`:

1. **Format, lint, typecheck, unit tests**, with coverage
2. **Build static site**, shared with the next two jobs
3. **Playwright** on Chromium and WebKit, with browsers cached between runs, and the coming-soon journey against its own build from the empty feed
4. **Lighthouse** with the mobile budget

`.github/workflows/nightly.yml` runs the Playwright suite on Firefox every night, and can be started by hand from the Actions tab.

Two more run on every push to `main`:

- **Merge audit** (`merge-audit.yml`, `scripts/audit-merge.sh`) fails when the commit came from a PR with neither a `Code review: passed at <head>` comment nor the `ready-for-human` label. Nothing on GitHub requires the review comment, so this makes a merge without one loud after the fact.
- **Conflict watch** (`conflict-watch.yml`, `scripts/flag-conflicts.sh`) comments on each open `ready-for-human` PR that no longer merges cleanly with main, and removes the comment once a push to that PR resolves it. GitHub skips pull-request runs while a PR conflicts, so only pushes to `main` can add the comment.

## Merging

Every pull request is reviewed before it merges or goes to a Jester (`AGENTS.md`, Merging). Merge with the helper. It merges only a head commit that has passed review and every check:

```bash
npm run review-passed -- <pr-number> <reviewed full SHA>   # after /code-review finds nothing serious
npm run merge -- <pr-number>
```

It waits for pending checks, stops at the first failure, and refuses a pull request with no checks or whose latest passed review names an older commit. Each push after a review needs its own review first (`AGENTS.md`, Merging). `scripts/merge-on-green.sh` has the details.

Visual pull requests go to a Jester instead: `npm run mark-ready -- <pr-number>` refuses a head without a passed review, as `merge` does (`scripts/require-review.sh`), then labels it once its checks and preview pass. See `AGENTS.md`.
