/**
 * @jest-environment node
 */
import { join } from "node:path";
import { requireFirstScreenCost } from "@/lib/pr-gate/first-screen-cost";
import { firstScreenFiles } from "../../../../scripts/pr-gate-first-screen";
import { scriptsDir } from "../../../paths";

// The real list, scripts/first-screen-files.sh, which the pre-commit reminder reads too.
const firstScreen = firstScreenFiles(join(scriptsDir, "first-screen-files.sh"));

// The refusal's lines, or [] when it passes.
function refusal(files: string[], body: string): string[] {
  const contents = {
    title: "",
    body,
    closingIssues: [],
    commitMessages: [],
    files,
  };
  try {
    requireFirstScreenCost(233, contents, firstScreen, "merge");
    return [];
  } catch (error) {
    return String((error as Error).message).split("\n");
  }
}

// #233's body as first written, before review asked for the comparison.
const noRun = "Closes #51.\n\n## Summary\n\nFour site-shell tidy-ups.";
const withRun = `${noRun}\n\n**\`npm run lighthouse:compare\`** against \`origin/main\`:`;

describe("first-screen cost", () => {
  it("passes a PR that touches no first-screen file", () => {
    expect(
      refusal(["src/lib/lighthouse.ts", "docs/testing.md"], noRun)
    ).toEqual([]);
  });

  it.each([
    "src/components/site-header.tsx",
    "src/components/header-frame.tsx",
    "src/components/site-footer.tsx",
    "src/app/layout.tsx",
  ])("refuses a change to %s whose body has no comparison", (path) => {
    expect(refusal(["src/lib/utils.ts", path], noRun)).toEqual([
      `Refusing to merge #233: it changes ${path}, and its body has no \`npm run lighthouse:compare\` output.`,
      "Run it against main (docs/testing.md, Performance), add its figures to the body, then rerun.",
    ]);
  });

  it("names every first-screen file it changes", () => {
    expect(
      refusal(
        ["src/app/layout.tsx", "src/components/site-header.tsx"],
        noRun
      )[0]
    ).toContain(
      "it changes src/app/layout.tsx, src/components/site-header.tsx, and its body"
    );
  });

  it("refuses an empty body", () => {
    expect(refusal(["src/components/site-footer.tsx"], "")).not.toEqual([]);
  });

  it("passes one whose body carries the comparison", () => {
    expect(refusal(["src/components/site-footer.tsx"], withRun)).toEqual([]);
  });
});
