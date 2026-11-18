/**
 * @jest-environment node
 */
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { scriptsDir } from "../../paths";

const script = join(scriptsDir, "first-screen-cost.sh");

// A stand-in gh that answers `gh pr view` from a fixture, filtered by the
// caller's own --jq through the real jq.
function pr(paths: string[], body: string | null) {
  const root = mkdtempSync(join(tmpdir(), "first-screen-cost-"));
  const fixture = join(root, "pr.json");
  writeFileSync(
    fixture,
    JSON.stringify({
      body,
      // Shaped as `gh pr view 233 --json files` answered on 16 November 2026.
      files: paths.map((path) => ({
        additions: 4,
        changeType: "MODIFIED",
        deletions: 2,
        path,
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
  const result = spawnSync("bash", [script, "233", "merge"], {
    env: { ...process.env, PATH: `${root}${delimiter}${process.env.PATH}` },
    encoding: "utf8",
  });
  rmSync(root, { recursive: true, force: true });
  return result;
}

// #233's body as first written, before review asked for the comparison.
const noRun = "Closes #51.\n\n## Summary\n\nFour site-shell tidy-ups.";
const withRun = `${noRun}\n\n**\`npm run lighthouse:compare\`** against \`origin/main\`:`;

describe("first-screen-cost.sh", () => {
  it("passes a PR that touches no first-screen file", () => {
    expect(pr(["src/lib/lighthouse.ts", "docs/testing.md"], noRun).status).toBe(
      0
    );
  });

  it.each([
    "src/components/site-header.tsx",
    "src/components/header-frame.tsx",
    "src/components/site-footer.tsx",
    "src/app/layout.tsx",
  ])("refuses a change to %s whose body has no comparison", (path) => {
    const result = pr(["src/lib/utils.ts", path], noRun);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `Refusing to merge #233: it changes ${path}, and its body has no \`npm run lighthouse:compare\` output`
    );
  });

  it("refuses an empty body", () => {
    expect(pr(["src/components/site-footer.tsx"], null).status).toBe(1);
  });

  it("passes one whose body carries the comparison", () => {
    expect(pr(["src/components/site-footer.tsx"], withRun).status).toBe(0);
  });
});
