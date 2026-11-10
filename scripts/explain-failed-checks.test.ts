/**
 * @jest-environment node
 */
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const script = join(__dirname, "explain-failed-checks.sh");

const RUN = "https://github.com/o/r/actions/runs/111/job/222";

// gh pr checks' lines: name, state, time, URL, and a description that's
// empty for an Actions job, tab-separated, as gh 2.x printed #194's on
// 2026-11-10 ("Build static site\tpass\t54s\thttps://…/job/128859934766\t").
const checks = (...lines: string[][]) =>
  lines.map((line) => [...line, ""].join("\t")).join("\n") + "\n";

// What CI's job log holds: colored, timestamped lines, as the API sends them.
// A test's error repeats for each retry; the cause is the line under it.
// Shaped as #194's run 42518742460 logged it on 2026-11-08.
const LOG = [
  "2026-11-08T20:12:11.0Z Running 12 tests",
  "2026-11-08T20:12:12.0Z ##[error]\u001b[31m  1) [webkit-phone] › e2e/coming-soon.spec.ts:13:9 › Coming soon\u001b[39m",
  "    \u001b[31mError: browserType.launch: Target page, context or browser has been closed\u001b[39m",
  "    Browser logs:",
  "2026-11-08T20:12:12.1Z ##[error]\u001b[31m  1) [webkit-phone] › e2e/coming-soon.spec.ts:13:9 › Coming soon\u001b[39m",
  "",
  "    Retry #1 ────────",
  "    Error: browserType.launch: Target page, context or browser has been closed",
  "2026-11-08T20:12:13.0Z ##[error]  2) [webkit-phone] › e2e/coming-soon.spec.ts:23:7 › the navigation",
  "    Error: expect(locator).toBeVisible() failed",
  "2026-11-08T20:12:40.0Z ##[error]Process completed with exit code 1.",
].join("\n");

// A stand-in for gh: every job's log is LOG, run 111 belongs to workflow 9,
// and main's newest run of it that wasn't cancelled (42524177084) failed the
// jobs in `mainFailed`.
function run(
  input: string,
  mainFailed: string[],
  mainConclusion = mainFailed.length > 0 ? "failure" : "success",
  log = LOG
) {
  const root = mkdtempSync(join(tmpdir(), "explain-failed-checks-"));
  writeFileSync(join(root, "log"), log);
  // main's newest push runs, newest first, as gh run list gave two of CI's on
  // 2026-11-10; the second's conclusion is the test's (it was a success).
  // ci.yml cancels a run superseded by the next push, so the newest is often
  // cancelled.
  writeFileSync(
    join(root, "runs.json"),
    JSON.stringify([
      {
        databaseId: 42525786397,
        url: "https://github.com/mbelmear/jesters-privilege/actions/runs/42525786397",
        conclusion: "cancelled",
      },
      {
        databaseId: 42524177084,
        url: "https://github.com/mbelmear/jesters-privilege/actions/runs/42524177084",
        conclusion: mainConclusion,
      },
    ])
  );
  writeFileSync(
    join(root, "gh"),
    `#!/bin/sh
case "$*" in
  */logs*) cat "${join(root, "log")}" ;;
  *runs/111*) echo 9 ;;
  "run list"*)
    # Apply the script's own --jq filter, as gh does.
    for arg; do [ "$prev" = --jq ] && filter=$arg; prev=$arg; done
    jq -r "$filter" "${join(root, "runs.json")}" ;;
  *runs/42524177084/jobs*) printf '${mainFailed.join("\\n")}\\n' ;;
  *) echo "unexpected gh $*" >&2; exit 1 ;;
esac
`
  );
  chmodSync(join(root, "gh"), 0o755);
  const result = spawnSync("bash", [script], {
    input,
    env: { ...process.env, PATH: `${root}${delimiter}${process.env.PATH}` },
    encoding: "utf8",
  });
  rmSync(root, { recursive: true, force: true });
  return result;
}

describe("explain-failed-checks", () => {
  const failing = checks(
    ["Playwright (Chromium, WebKit)", "fail", "1m59s", RUN],
    [
      "Lint workflows",
      "pass",
      "11s",
      "https://github.com/o/r/actions/runs/111/job/444",
    ]
  );

  it("prints each failed test once, with the error under it, without color", () => {
    // A passing check whose log and main's run would both be printed, were it
    // explained, so its absence below can fail.
    const result = run(failing, ["Lint workflows"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      [
        "Playwright (Chromium, WebKit) failed with:",
        "  1) [webkit-phone] › e2e/coming-soon.spec.ts:13:9 › Coming soon",
        "    Error: browserType.launch: Target page, context or browser has been closed",
        "  2) [webkit-phone] › e2e/coming-soon.spec.ts:23:7 › the navigation",
        "    Error: expect(locator).toBeVisible() failed",
        "",
      ].join("\n")
    );
    expect(result.stdout).not.toContain("\u001b");
    // The job's own last error line isn't a failed test.
    expect(result.stdout).not.toContain("Process completed");
    expect(result.stdout).not.toContain("Lint workflows");
  });

  it("shows 10 failed tests, and counts the rest", () => {
    const log = Array.from(
      { length: 12 },
      (_, i) => `2026-11-08T20:12:12.0Z ##[error]  ${i + 1}) test ${i + 1}`
    ).join("\n");

    const result = run(failing, [], "success", log);

    expect(result.stdout).toContain(
      "  10) test 10\n  …and 2 more in the job's log: " + RUN
    );
    expect(result.stdout).not.toContain("11) test 11");
  });

  it("says when main's newest finished run fails the same check, passing over cancelled ones", () => {
    const result = run(failing, ["Playwright (Chromium, WebKit)"]);

    expect(result.stdout).toContain(
      "main's newest finished push run of this workflow fails Playwright (Chromium, WebKit) too (https://github.com/mbelmear/jesters-privilege/actions/runs/42524177084), so this PR may not be the cause. Look for an open issue (gh issue list) before rerunning it."
    );
  });

  it("says nothing of main when main passes the check", () => {
    const result = run(failing, ["Something else"]);

    expect(result.stdout).not.toContain("main's newest");
  });
});
