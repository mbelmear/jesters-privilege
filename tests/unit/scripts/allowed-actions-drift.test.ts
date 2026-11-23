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
import { scriptsDir } from "../../paths";

const script = join(scriptsDir, "allowed-actions-drift.sh");

// Runs the hook in a directory holding .github/allowed-actions.json, with a
// stand-in for gh on the PATH that prints `answer` (or fails) and logs its
// arguments.
let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "allowed-actions-drift-"));
  mkdirSync(join(root, ".github"));
  mkdirSync(join(root, "bin"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

// Recorded: gh 2.103.3, gh api repos/mbelmear/jesters-privilege/actions/permissions/selected-actions
// on 2026-11-23, as it printed it.
const live = {
  github_owned_allowed: true,
  patterns_allowed: [
    "rhysd/actionlint@*",
    "docker://rhysd/actionlint:*",
    "docker://rhysd/actionlint@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667",
  ],
  verified_allowed: false,
};
const sha256 = live.patterns_allowed[2];

function runHook(
  file: object | undefined,
  answer: object,
  exit = 0
): ReturnType<typeof spawnSync> & { args: string } {
  if (file)
    writeFileSync(
      join(root, ".github/allowed-actions.json"),
      JSON.stringify(file, null, 2)
    );
  writeFileSync(join(root, "answer"), JSON.stringify(answer));
  writeFileSync(
    join(root, "bin/gh"),
    `#!/bin/sh
echo "$*" > "${join(root, "args")}"
[ ${exit} -eq 0 ] || exit ${exit}
cat "${join(root, "answer")}"
`
  );
  chmodSync(join(root, "bin/gh"), 0o755);
  // The hook reads the repo Claude Code opened, not its working directory.
  const result = spawnSync("bash", [script], {
    cwd: tmpdir(),
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: root,
      PATH: `${join(root, "bin")}${delimiter}${process.env.PATH}`,
    },
    encoding: "utf8",
  });
  return { ...result, args: readFileSync(join(root, "args"), "utf8").trim() };
}

describe("allowed-actions-drift", () => {
  it("asks GitHub for the repo's Actions allowlist", () => {
    // live recorded (above).
    const result = runHook(live, live);

    expect(result.args).toBe(
      "api repos/{owner}/{repo}/actions/permissions/selected-actions"
    );
  });

  it("says nothing when the file matches GitHub, whatever the order", () => {
    const reordered = {
      verified_allowed: false,
      patterns_allowed: [...live.patterns_allowed].reverse(),
      github_owned_allowed: true,
    };

    // live recorded (above).
    const result = runHook(reordered, live);

    expect(result.stdout).toBe("");
    expect(result.status).toBe(0);
  });

  it("names what differs when the setting changed and the file didn't", () => {
    // Made up: a pattern added on GitHub only.
    const result = runHook(live, {
      ...live,
      patterns_allowed: [...live.patterns_allowed, "dorny/paths-filter@*"],
    });

    expect(result.stdout).toBe(
      `GitHub's Actions allowlist (gh api 'repos/{owner}/{repo}/actions/permissions/selected-actions') differs from .github/allowed-actions.json, which the unit tests check every workflow's uses: against. GitHub: {"github_owned_allowed":true,"patterns_allowed":["docker://rhysd/actionlint:*","${sha256}","dorny/paths-filter@*","rhysd/actionlint@*"],"verified_allowed":false}. The file: {"github_owned_allowed":true,"patterns_allowed":["docker://rhysd/actionlint:*","${sha256}","rhysd/actionlint@*"],"verified_allowed":false}. Tell the user, and make them match in a worktree (docs/testing.md, In CI).\n`
    );
    expect(result.status).toBe(0);
  });

  it("says it couldn't read the setting when gh fails, without failing the session", () => {
    // Made up.
    const result = runHook(live, {}, 1);

    expect(result.stdout).toBe(
      "Couldn't read GitHub's Actions allowlist (gh api 'repos/{owner}/{repo}/actions/permissions/selected-actions'), so whether .github/allowed-actions.json matches it is unknown.\n"
    );
    expect(result.status).toBe(0);
  });

  it("says the file is missing or unreadable, without failing the session", () => {
    // live recorded (above).
    const result = runHook(undefined, live);

    expect(result.stdout).toBe(
      "Couldn't read .github/allowed-actions.json, so whether it matches GitHub's Actions allowlist is unknown.\n"
    );
    expect(result.status).toBe(0);
  });
});
