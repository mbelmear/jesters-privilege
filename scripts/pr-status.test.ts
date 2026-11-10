/**
 * @jest-environment node
 */
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const script = join(__dirname, "pr-status.sh");
const HEAD = "a".repeat(40);

// Stand-ins for gh and sleep on the PATH: an open PR at HEAD that merges
// cleanly, with the checks and comment each test gives, exiting as gh pr checks
// does, and a sleep that only counts, then swaps in the `afterSleep` checks. A
// `drop` file makes the next read of the checks a dropped connection. Run outside
// any checkout, so wait-pushed-head.sh takes GitHub's head.
function fakes(checks: string, comment = "", afterSleep = "") {
  const root = mkdtempSync(join(tmpdir(), "pr-status-"));
  const bin = join(root, "bin");
  const sleeps = join(root, "sleeps");
  mkdirSync(bin);
  writeFileSync(sleeps, "");
  const tool = (name: string, body: string) => {
    writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  };
  writeFileSync(join(root, "checks"), checks);
  writeFileSync(join(root, "comment"), comment);
  writeFileSync(join(root, "after-sleep"), afterSleep);
  tool(
    "gh",
    `case "$*" in
  "api -X GET "*) echo failure ;;
  "api "*) echo api >> "${join(root, "api-calls")}"; echo "##[error] the cause" ;;
  *headRefName*) echo ticket ;;
  *headRefOid*) echo ${HEAD} ;;
  *statusCheckRollup*) echo 3 ;;
  *mergeable*) echo MERGEABLE ;;
  *comments*) cat "${join(root, "comment")}" ;;
  *state*) echo OPEN ;;
  "pr checks"*)
    if [ -e "${join(root, "drop")}" ]; then
      rm "${join(root, "drop")}"
      echo "error connecting to api.github.com" >&2
      exit 1
    fi
    cat "${join(root, "checks")}"
    if grep -q fail "${join(root, "checks")}"; then exit 1; fi
    if grep -q pending "${join(root, "checks")}"; then exit 8; fi
    ;;
  *) echo "pr-status.test.ts has no answer for: gh $*" >&2; exit 1 ;;
esac`
  );
  tool(
    "sleep",
    `echo slept >> "${sleeps}"
if [ -s "${join(root, "after-sleep")}" ]; then
  cp "${join(root, "after-sleep")}" "${join(root, "checks")}"
fi`
  );
  const run = () =>
    spawnSync("bash", [script, "7"], {
      cwd: root,
      env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}` },
      encoding: "utf8",
    });
  const sleepCount = () =>
    readFileSync(sleeps, "utf8").split("\n").filter(Boolean).length;
  return { root, run, sleepCount };
}

describe("pr-status", () => {
  let f: ReturnType<typeof fakes>;
  afterEach(() => {
    rmSync(f.root, { recursive: true, force: true });
  });

  const SKIPPED_PREVIEW = "Preview URL\tskipping\t0\n";

  it("waits for pending checks, then reports them", () => {
    f = fakes(
      `Lint workflows\tpending\t0\n${SKIPPED_PREVIEW}`,
      "",
      `Lint workflows\tpass\t8s\n${SKIPPED_PREVIEW}`
    );

    const result = f.run();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Lint workflows\tpass\n");
    expect(f.sleepCount()).toBe(1);
  });

  it("waits for every check to finish after one fails, then fails", () => {
    f = fakes(
      `Lint workflows\tfail\t8s\nBuild\tpending\t0\n${SKIPPED_PREVIEW}`,
      "",
      `Lint workflows\tfail\t8s\nBuild\tpass\t9s\n${SKIPPED_PREVIEW}`
    );

    const result = f.run();

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Build\tpass\n");
    expect(result.stdout).not.toContain("pending");
    expect(result.stderr).toContain(
      "Lint workflows: main's head fails it too, so the cause is likely CI"
    );
    expect(f.sleepCount()).toBe(1);
  });

  it("prints a failed job's errors once, after every check finishes", () => {
    const failed =
      "Lint workflows\tfail\t8s\thttps://github.com/o/r/actions/runs/4/job/42";
    f = fakes(
      `${failed}\nBuild\tpending\t0\n${SKIPPED_PREVIEW}`,
      "",
      `${failed}\nBuild\tpass\t9s\n${SKIPPED_PREVIEW}`
    );

    const result = f.run();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Lint workflows failed:\n##[error] the cause"
    );
    expect(f.sleepCount()).toBe(1);
    expect(readFileSync(join(f.root, "api-calls"), "utf8")).toBe("api\n");
  });

  it("reads through a dropped connection", () => {
    f = fakes(`Lint workflows\tpass\t8s\n${SKIPPED_PREVIEW}`);
    writeFileSync(join(f.root, "drop"), "");

    const result = f.run();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Lint workflows\tpass\n");
    expect(f.sleepCount()).toBe(1);
  });

  it("doesn't wait for a preview whose job was skipped", () => {
    f = fakes("Lint workflows\tpass\t8s\nPreview URL\tskipping\t0\n");

    const result = f.run();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Preview: none, its job was skipped\n");
    expect(result.stdout).toContain("Merges cleanly with main: yes\n");
    expect(f.sleepCount()).toBe(0);
  });

  it("waits for the preview of a job that ran, and reports its URL", () => {
    f = fakes(
      "Preview URL\tpass\t3m\n",
      `<!-- deploy-preview -->\n**Preview:** https://pr-7.example.workers.dev\n\nBuilt from ${HEAD}.`
    );

    const result = f.run();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "Preview: https://pr-7.example.workers.dev\n"
    );
  });

  it("gives up on a preview that never arrives, saying so", () => {
    f = fakes("Preview URL\tpass\t3m\n");

    const result = f.run();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Preview: none built from aaaaaaa yet\n");
    expect(f.sleepCount()).toBe(30);
  });
});
