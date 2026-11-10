/**
 * @jest-environment node
 */
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const script = join(__dirname, "failed-job-logs.sh");

// Rows as gh pr checks prints them: name, state, time, link.
const FAILED =
  "Playwright, empty feed\tfail\t2m30s\thttps://github.com/o/r/actions/runs/4/job/42\t";
const PASSED =
  "Build static site\tpass\t1m2s\thttps://github.com/o/r/actions/runs/4/job/41\t";

// Trimmed from the log of the job that stopped #193's merge (job 128846841853),
// colours and all.
const LOG = [
  "2026-11-08T20:10:31.0Z Running 56 tests using 2 workers",
  "2026-11-08T20:10:32.6Z \x1b[31m##[error]  1) [webkit-phone] › e2e/coming-soon.spec.ts:13:9 › Coming soon\x1b[39m",
  "    Error: browserType.launch: Target page, context or browser has been closed",
  "    [pid=5804][err] MiniBrowser: error while loading shared libraries: libicudata.so.74",
].join("\n");

// A stand-in for gh on the PATH that logs each call and prints `log` for the
// job-logs API, or fails as GitHub does when it can't serve one.
function fakes(log: string | null) {
  const root = mkdtempSync(join(tmpdir(), "failed-job-logs-"));
  const calls = join(root, "calls");
  if (log !== null) writeFileSync(join(root, "log"), log);
  writeFileSync(
    join(root, "gh"),
    `#!/bin/sh
echo "$*" >> "${calls}"
[ -e "${join(root, "log")}" ] || { echo "HTTP 404: Not Found" >&2; exit 1; }
cat "${join(root, "log")}"
`
  );
  chmodSync(join(root, "gh"), 0o755);
  const run = (checks: string) =>
    spawnSync("bash", [script], {
      input: checks,
      env: { ...process.env, PATH: `${root}${delimiter}${process.env.PATH}` },
      encoding: "utf8",
    });
  const callsMade = () =>
    existsSync(calls) ? readFileSync(calls, "utf8").trim().split("\n") : [];
  return { root, run, callsMade };
}

describe("failed-job-logs", () => {
  let f: ReturnType<typeof fakes>;
  afterEach(() => {
    rmSync(f.root, { recursive: true, force: true });
  });

  it("prints a failed job's log from its first error, without colours or timestamps", () => {
    f = fakes(LOG);

    const result = f.run(`${PASSED}\n${FAILED}\n`);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      [
        "Playwright, empty feed failed:",
        "##[error]  1) [webkit-phone] › e2e/coming-soon.spec.ts:13:9 › Coming soon",
        "    Error: browserType.launch: Target page, context or browser has been closed",
        "    [pid=5804][err] MiniBrowser: error while loading shared libraries: libicudata.so.74",
        "",
      ].join("\n")
    );
    expect(f.callsMade()).toEqual([
      "api --allow-escape-sequences repos/o/r/actions/jobs/42/logs",
    ]);
  });

  it("reads no log when nothing failed", () => {
    f = fakes(LOG);

    const result = f.run(`${PASSED}\n`);

    expect(result.stdout).toBe("");
    expect(f.callsMade()).toEqual([]);
  });

  it("says so when the log has no error line", () => {
    f = fakes("2026-11-08T20:10:31.0Z Running 56 tests using 2 workers\n");

    const result = f.run(`${FAILED}\n`);

    expect(result.stdout).toContain(
      "Playwright, empty feed failed, with no ##[error] line in its log: https://github.com/o/r/actions/runs/4/job/42"
    );
  });

  it("says so when the log can't be read", () => {
    f = fakes(null);

    const result = f.run(`${FAILED}\n`);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "Couldn't read Playwright, empty feed's log: https://github.com/o/r/actions/runs/4/job/42"
    );
  });
});
