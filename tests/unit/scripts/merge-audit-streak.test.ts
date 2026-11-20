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

function runHook(conclusions: string[], exit = 0) {
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
    const result = runHook(["success"]);

    expect(result.args).toBe(
      "run list --workflow merge-audit.yml --branch main --status completed --limit 20 --json conclusion --jq .[].conclusion"
    );
  });

  it("says nothing when the newest run passed", () => {
    // Made up.
    const result = runHook(["success", "failure", "failure"]);

    expect(result.stdout).toBe("");
    expect(result.status).toBe(0);
  });

  it("counts the failures since the last pass", () => {
    // Made up.
    const result = runHook(["failure", "failure", "failure", "success"]);

    expect(result.stdout).toBe(
      "Merge audit didn't pass on the last 3 merges to main. It fails a merge without a passed review recorded at its head (docs/testing.md, Merging). Tell the user before merging anything else; gh run list --workflow merge-audit.yml shows which.\n"
    );
    expect(result.status).toBe(0);
  });

  it("counts past a cancelled run, which neither passed nor failed", () => {
    // Made up.
    const result = runHook(["failure", "cancelled", "failure", "success"]);

    expect(result.stdout).toContain("on 2 of the last 3 merges to main.");
  });

  it("counts an audit that timed out as one that didn't pass", () => {
    // Made up.
    const result = runHook(["timed_out", "failure", "success"]);

    expect(result.stdout).toContain("on the last 2 merges to main.");
  });

  it("says the streak may run further back when none of the runs read passed", () => {
    // Made up.
    const result = runHook([...Array<string>(19).fill("failure"), "cancelled"]);

    expect(result.stdout).toContain(
      "on 19 of the last 20 merges to main, and none of the 20 runs read passed."
    );
  });

  // Fewer runs than it asks for are the whole history.
  it("says nothing further back when it read every run", () => {
    // Made up.
    expect(runHook(["failure"]).stdout).toContain(
      "on the last 1 merge to main. It fails"
    );
  });

  it("says nothing when there are no runs", () => {
    // Made up: gh's --jq prints nothing for an empty list.
    const result = runHook([]);

    expect(result.stdout).toBe("");
    expect(result.status).toBe(0);
  });

  it("says one merge as one", () => {
    // Made up.
    expect(runHook(["failure", "success"]).stdout).toContain(
      "on the last 1 merge to main."
    );
  });

  // Recorded: gh 2.103.3 on 2026-11-20, when every one of the newest 20 had failed.
  it("says when none of the 20 it read passed", () => {
    const result = runHook(Array<string>(20).fill("failure"));

    expect(result.stdout).toContain(
      "on the last 20 merges to main, and none of the 20 runs read passed."
    );
  });

  it("says so when it can't read the runs", () => {
    // Made up.
    const result = runHook([], 1);

    expect(result.stdout).toBe(
      "Couldn't read Merge audit's runs (gh run list --workflow merge-audit.yml), so whether recent merges kept their review is unknown.\n"
    );
    expect(result.status).toBe(0);
  });
});
