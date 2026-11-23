/**
 * @jest-environment node
 */
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { scriptsDir } from "../../paths";

const script = join(scriptsDir, "security-alerts.sh");

// A stand-in for gh on the PATH, answering `gh api` with one
// "<severity> <package>" line per open alert, and logging its arguments.
let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "security-alerts-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function runHook(alerts: string[], exit = 0) {
  writeFileSync(join(root, "answer"), alerts.map((a) => `${a}\n`).join(""));
  writeFileSync(
    join(root, "gh"),
    `#!/bin/sh
echo "$*" > "${join(root, "args")}"
cat "${join(root, "answer")}"
exit ${exit}
`
  );
  chmodSync(join(root, "gh"), 0o755);
  const result = spawnSync("bash", [script], {
    env: { ...process.env, PATH: `${root}${delimiter}${process.env.PATH}` },
    encoding: "utf8",
  });
  return { ...result, args: readFileSync(join(root, "args"), "utf8").trim() };
}

describe("security-alerts", () => {
  it("asks for the repo's open Dependabot alerts", () => {
    // Made up.
    const result = runHook([]);

    expect(result.args).toBe(
      'api repos/{owner}/{repo}/dependabot/alerts?state=open&per_page=100 --jq .[] | "\\(.security_advisory.severity) \\(.dependency.package.name)"'
    );
  });

  it("says nothing when no alert is open", () => {
    // Made up.
    const result = runHook([]);

    expect(result.stdout).toBe("");
    expect(result.status).toBe(0);
  });

  // The minimatch alert sat open from 2026-11-05 to 2026-11-22 unread.
  it("names each open alert's package and severity", () => {
    // Made up.
    const result = runHook(["medium minimatch", "high glob"]);

    expect(result.stdout).toBe(
      "2 open Dependabot alerts: minimatch (medium), glob (high). Tell the user; gh api 'repos/{owner}/{repo}/dependabot/alerts?state=open' has the advisories, and docs/testing.md (Dependency advisories) says how to fix one.\n"
    );
    expect(result.status).toBe(0);
  });

  it("says one alert in the singular", () => {
    // Made up.
    const result = runHook(["low tar"]);

    expect(result.stdout).toMatch(/^1 open Dependabot alert: tar \(low\)\. /);
  });

  it("says it couldn't read the alerts when gh fails, without failing the session", () => {
    // Made up.
    const result = runHook([], 1);

    expect(result.stdout).toBe(
      "Couldn't read the open Dependabot alerts (gh api 'repos/{owner}/{repo}/dependabot/alerts?state=open'), so whether any are open is unknown.\n"
    );
    expect(result.status).toBe(0);
  });
});
