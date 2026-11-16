/**
 * @jest-environment node
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(__dirname, "lint-shell.sh");

describe("lint-shell", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "lint-shell-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const lint = (body: string) => {
    const file = join(dir, "sample.sh");
    writeFileSync(file, `#!/usr/bin/env bash\nset -euo pipefail\n${body}`);
    return spawnSync("bash", [script, file], { encoding: "utf8" });
  };

  // #226's restored-to-main.sh shipped this shape: a mistyped head made git
  // fail inside <(...), which set -e can't see, and every file read as restored.
  it("refuses a command whose failure would read as an answer", () => {
    const result = lint(
      'comm -23 <(git diff --name-only "$1") <(git diff --name-only "$2")\n'
    );
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("SC2312");
  });

  it("passes the same commands read into variables first", () => {
    const result = lint(
      'was=$(git diff --name-only "$1")\nnow=$(git diff --name-only "$2")\ncomm -23 <(printf "%s\\n" "$was") <(printf "%s\\n" "$now")\n'
    );
    expect(result.stdout).toBe("");
    expect(result.status).toBe(0);
  });

  it("still refuses shellcheck's warnings", () => {
    const result = lint("unused=1\n");
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("SC2034");
  });
});
