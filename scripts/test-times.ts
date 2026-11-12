// Runs Playwright and prints where its time went, per project and per test:
// each project's run and skipped tests and worker-seconds, then every test over
// the threshold with its time in each project. The logic is
// src/lib/test-times.ts. Measure with it before and after a change meant to
// speed tests up, and before sizing one (#210).
// Usage: npm run test-times -- [--slow <seconds, default 5>] [playwright args]
// It runs Chromium and WebKit at CI's 2 workers unless the args name projects
// or workers; the spec files and any other flags pass through.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatTestTimes, readReport, summariseTests } from "@/lib/test-times";

const args = process.argv.slice(2);
const slowAt = args.indexOf("--slow");
const slow = slowAt === -1 ? 5 : Number(args[slowAt + 1]);
if (!Number.isFinite(slow) || slow < 0) {
  throw new Error(
    `--slow takes a number of seconds, not "${args[slowAt + 1]}"`
  );
}
const passed = slowAt === -1 ? args : args.toSpliced(slowAt, 2);
const names = (flag: string) => passed.some((arg) => arg.startsWith(flag));

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
    ...(names("--workers") ? [] : ["--workers=2"]),
    ...passed,
  ],
  {
    stdio: ["inherit", "ignore", "inherit"],
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: report },
  }
);

const json: unknown = JSON.parse(readFileSync(report, "utf8"));
console.log(formatTestTimes(summariseTests(readReport(json), slow)));
if (status !== 0) {
  console.error(`Playwright exited with ${status}: some tests failed.`);
  process.exit(status ?? 1);
}
