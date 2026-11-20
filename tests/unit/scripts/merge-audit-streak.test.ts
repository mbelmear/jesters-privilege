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

const script = join(scriptsDir, "merge-audit-streak.sh");

// A stand-in for gh on the PATH, answering `gh run list` with one conclusion
// per line, newest first, and logging its arguments.
let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "merge-audit-streak-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function streak(conclusions: string[], exit = 0) {
  writeFileSync(
    join(root, "answer"),
    conclusions.map((c) => `${c}\n`).join("")
  );
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

describe("merge-audit-streak", () => {
  it("asks for main's finished Merge audit runs, newest first", () => {
    // Made up.
    const result = streak(["success"]);

    expect(result.args).toBe(
      "run list --workflow merge-audit.yml --branch main --status completed --limit 20 --json conclusion --jq .[].conclusion"
    );
  });

  it("says nothing when the newest run passed", () => {
    // Made up.
    const result = streak(["success", "failure", "failure"]);

    expect(result.stdout).toBe("");
    expect(result.status).toBe(0);
  });

  it("counts the failures since the last pass", () => {
    // Made up.
    const result = streak(["failure", "failure", "failure", "success"]);

    expect(result.stdout).toBe(
      "Merge audit failed on the last 3 merges to main: each merged without a passed review recorded at its head (docs/testing.md, Merging). Tell the user before merging anything else; gh run list --workflow merge-audit.yml shows which.\n"
    );
    expect(result.status).toBe(0);
  });

  it("says one merge as one", () => {
    // Made up.
    expect(streak(["failure", "success"]).stdout).toContain(
      "on the last 1 merge to main"
    );
  });

  // Recorded: gh 2.103.3 on 2026-11-20, when every one of the newest 20 had failed.
  it("says it's at least as many as it read when none passed", () => {
    const result = streak(Array<string>(20).fill("failure"));

    expect(result.stdout).toContain("on the last 20 or more merges to main");
  });

  it("says so when it can't read the runs", () => {
    // Made up.
    const result = streak([], 1);

    expect(result.stdout).toBe(
      "Couldn't read Merge audit's runs (gh run list --workflow merge-audit.yml), so whether recent merges kept their review is unknown.\n"
    );
    expect(result.status).toBe(0);
  });
});
