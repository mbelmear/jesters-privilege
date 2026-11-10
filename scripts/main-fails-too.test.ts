/**
 * @jest-environment node
 */
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const script = join(__dirname, "main-fails-too.sh");

// gh pr checks' rows: name, state, time, link, and a description that's
// empty for an Actions job, as gh printed #194's on 2026-11-10.
const FAILED =
  "Playwright (Chromium, WebKit)\tfail\t1m59s\thttps://github.com/o/r/actions/runs/111/job/222\t";
const PASSED =
  "Lint workflows\tpass\t11s\thttps://github.com/o/r/actions/runs/111/job/444\t";

const RUNS = "https://github.com/mbelmear/jesters-privilege/actions/runs/";

// A stand-in for gh: run 111 belongs to workflow 9, and main's push runs of
// it are two of CI's as gh run list gave them on 2026-11-10, newest first,
// the second's conclusion the test's (it was a success). ci.yml cancels a run
// superseded by the next push, so the newest is often cancelled. The second
// failed the jobs in `mainFailed`.
function run(checks: string, mainFailed: string[], runsReadable = true) {
  const root = mkdtempSync(join(tmpdir(), "main-fails-too-"));
  writeFileSync(
    join(root, "runs.json"),
    JSON.stringify([
      {
        databaseId: 42525786397,
        url: `${RUNS}42525786397`,
        conclusion: "cancelled",
      },
      {
        databaseId: 42524177084,
        url: `${RUNS}42524177084`,
        conclusion: mainFailed.length > 0 ? "failure" : "success",
      },
    ])
  );
  writeFileSync(
    join(root, "gh"),
    `#!/bin/sh
case "$*" in
  *runs/111*) echo 9 ;;
  "run list"*)
    ${runsReadable ? "" : 'echo "HTTP 403: Resource not accessible by integration" >&2; exit 1'}
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
    input: checks,
    env: { ...process.env, PATH: `${root}${delimiter}${process.env.PATH}` },
    encoding: "utf8",
  });
  rmSync(root, { recursive: true, force: true });
  return result;
}

describe("main-fails-too", () => {
  it("says when main's newest finished run fails the same check, passing over cancelled ones", () => {
    const result = run(`${PASSED}\n${FAILED}\n`, [
      "Playwright (Chromium, WebKit)",
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      `main's newest finished push run of this workflow fails Playwright (Chromium, WebKit) too (${RUNS}42524177084), so this PR may not be the cause. Look for an open issue (gh issue list) before rerunning it.\n`
    );
  });

  it("asks nothing about a check that passed", () => {
    // main fails it too, so it would be named if it were asked about.
    const result = run(`${PASSED}\n`, ["Lint workflows"]);

    expect(result.stdout).toBe("");
  });

  it("says so when main's runs can't be read, rather than seeming to pass", () => {
    const result = run(`${FAILED}\n`, ["Playwright (Chromium, WebKit)"], false);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      "Couldn't check main's newest run for Playwright (Chromium, WebKit): https://github.com/o/r/actions/runs/111/job/222\n"
    );
  });

  it("says nothing when main passes the check", () => {
    const result = run(`${FAILED}\n`, ["Something else"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });
});
