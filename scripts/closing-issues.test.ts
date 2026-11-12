/**
 * @jest-environment node
 */
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const script = join(__dirname, "closing-issues.sh");

// A stand-in gh that answers `gh pr view` from a fixture, filtered by the
// caller's own --jq through the real jq. gh's --jq is gojq, whose regexes
// have no lookahead where jq's do, so the filter keeps to what both read.
function pr(title: string, body: string | null, closes: number[]) {
  const root = mkdtempSync(join(tmpdir(), "closing-issues-"));
  const fixture = join(root, "pr.json");
  writeFileSync(
    fixture,
    JSON.stringify({
      title,
      body,
      // Each as `gh pr view 211 --json closingIssuesReferences` answered on
      // 12 November 2026.
      closingIssuesReferences: closes.map((number) => ({
        id: "I_kwDOVZ_PPc8AAAABed5_xA",
        number,
        repository: {
          id: "R_kgDOVZ_PPQ",
          name: "jesters-privilege",
          owner: { id: "MDQ6VXNlcjkwMDA4MDU1", login: "mbelmear" },
        },
        url: `https://github.com/mbelmear/jesters-privilege/issues/${number}`,
      })),
    })
  );
  writeFileSync(
    join(root, "gh"),
    `#!/bin/bash
filter="."
while (($#)); do
  [[ $1 == --jq ]] && { filter=$2; shift; }
  shift
done
jq -r "$filter" "${fixture}"
`
  );
  chmodSync(join(root, "gh"), 0o755);
  const result = spawnSync("bash", [script, "211", "merge"], {
    env: { ...process.env, PATH: `${root}${delimiter}${process.env.PATH}` },
    encoding: "utf8",
  });
  rmSync(root, { recursive: true, force: true });
  return result;
}

describe("closing-issues.sh", () => {
  it("passes a PR that closes only the issue its title names", () => {
    expect(pr("A fix (#158)", "Closes #158.\n\nMore.", [158]).status).toBe(0);
  });

  it("passes one that closes issues its body's first line names", () => {
    // #202's first line, the retro of #188 and #196.
    const first =
      "Part of the retro of #188 and #196. Closes #181, closes #200.";
    expect(pr("Retro of #188 and #196", first, [181, 200]).status).toBe(0);
  });

  it("passes one that closes nothing", () => {
    expect(pr("Retro of #158", "Fix #209 before #145.", []).status).toBe(0);
  });

  // #211 said "Fix #209 before #145." in its evidence, and GitHub closed #209
  // when it merged.
  it("refuses one that would close an issue named only further down", () => {
    const body = "Closes #158.\n\n- Fix #209 before #145.";
    const result = pr("A fix (#158)", body, [158, 209]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Refusing to merge #211: merging it closes #209"
    );
    expect(result.stderr).not.toContain("#158");
  });

  it("reads a PR with no body", () => {
    expect(pr("A fix (#158)", null, [158]).status).toBe(0);
  });

  it("tells #20 from #209", () => {
    expect(
      pr("A fix (#20)", "Closes #20.\nFix #209.", [20, 209]).stderr
    ).toContain("closes #209");
  });
});
