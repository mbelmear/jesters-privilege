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
// cleanly, with the checks and comment each test gives, and a sleep that only
// counts. Run outside any checkout, so wait-pushed-head.sh takes GitHub's head.
function fakes(checks: string, comment = "") {
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
  tool(
    "gh",
    `case "$*" in
  *headRefName*) echo ticket ;;
  *headRefOid*) echo ${HEAD} ;;
  *statusCheckRollup*) echo 3 ;;
  *mergeable*) echo MERGEABLE ;;
  *comments*) cat "${join(root, "comment")}" ;;
  *state*) echo OPEN ;;
  "pr checks"*) cat "${join(root, "checks")}" ;;
esac`
  );
  tool("sleep", `echo slept >> "${sleeps}"`);
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
