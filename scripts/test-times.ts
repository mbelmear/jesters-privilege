// Runs Playwright and prints where its time went, per project and per test:
// each project's run and skipped tests and worker-seconds, then every test over
// the threshold with its time in each project. The logic is
// src/lib/test-times.ts. Measure with it before and after a change meant to
// speed tests up, and before sizing one (#210).
// Usage: npm run test-times -- [--slow <seconds, default 5>] [playwright args]
// It runs Chromium and WebKit at CI's 2 workers unless the args name projects
// or workers; the spec files and any other flags pass through.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatTestTimes, readReport, summariseTests } from "@/lib/test-times";

// --slow is this script's own, as `--slow 5` or `--slow=5`; the rest is
// Playwright's.
const args = process.argv.slice(2);
const slowAt = args.findIndex(
  (arg) => arg === "--slow" || arg.startsWith("--slow=")
);
const slowArg =
  slowAt === -1
    ? "5"
    : args[slowAt].startsWith("--slow=")
      ? args[slowAt].slice("--slow=".length)
      : args[slowAt + 1];
const slow = Number(slowArg);
if (!Number.isFinite(slow) || slow < 0) {
  throw new Error(`--slow takes a number of seconds, not "${slowArg}"`);
}
const passed =
  slowAt === -1
    ? args
    : args.toSpliced(slowAt, args[slowAt] === "--slow" ? 2 : 1);
// Whether the args already name one of a flag's spellings, as `-j 4`,
// `-j4`, `--workers 4` or `--workers=4`.
const names = (...flags: string[]) =>
  passed.some((arg) => flags.some((flag) => arg.startsWith(flag)));

const report = join(mkdtempSync(join(tmpdir(), "test-times-")), "report.json");
const { status } = spawnSync(
  "npx",
  [
    "playwright",
    "test",
    "--reporter=json",
    ...(names("--project")
      ? []
      : ["--project=chromium-*", "--project=webkit-*"]),
    ...(names("--workers", "-j") ? [] : ["--workers=2"]),
    ...passed,
  ],
  {
    stdio: ["inherit", "ignore", "inherit"],
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: report },
  }
);

// Playwright writes no report when it stops before running, as with no build;
// its own error is above.
if (!existsSync(report)) {
  console.error(`Playwright exited with ${status} and wrote no report.`);
  process.exit(status || 1);
}
const json: unknown = JSON.parse(readFileSync(report, "utf8"));
console.log(formatTestTimes(summariseTests(readReport(json), slow)));
if (status !== 0) {
  console.error(`Playwright exited with ${status}: some tests failed.`);
  process.exit(status ?? 1);
}
