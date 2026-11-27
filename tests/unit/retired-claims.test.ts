/**
 * @jest-environment node
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../paths";

// Claims a change made false, each with what is true now. A ticket that
// changes how the system behaves (a cadence, a trigger, who presses what)
// adds the phrases it retires, so a stale one fails here rather than in
// review: #302 made the feed check hourly, and each of its four review rounds
// still found the old 2-hourly wording somewhere. Open issues are out of
// reach; docs/testing.md, Merging, says to search them too. ADRs keep their
// history, so they're left as written.
const RETIRED: [RegExp, string][] = [
  [
    /\bfeed (?:check )?every 2 hours|every 2 hours,? the feed check|checks the (?:podcast )?feed every 2 hours/i,
    "the Worker starts the feed check hourly; GitHub's 2-hourly schedule is its backstop (ADR 0004)",
  ],
  [
    /\brelease day means pressing\b/i,
    "a new Episode goes live within about 1¼ hours, with no button (ADR 0004)",
  ],
  [/\buntil #302\b/, "#302 is done (ADR 0004)"],
  [
    /\bhalf an hour after (?:each|the) feed check\b/i,
    "Deploy starts Transcribe once it deploys a new Episode (ADR 0004)",
  ],
];

const LEFT_AS_WRITTEN = [
  "package-lock.json",
  "tests/unit/retired-claims.test.ts",
];

const files = execFileSync("git", ["ls-files"], {
  cwd: repoRoot,
  encoding: "utf8",
})
  .split("\n")
  .filter((path) => /\.(md|ts|tsx|mjs|yml|yaml|sh|json)$/.test(path))
  .filter(
    (path) =>
      !path.startsWith("docs/inputs/") &&
      !path.startsWith("docs/adr/") &&
      !LEFT_AS_WRITTEN.includes(path)
  )
  .filter((path) => existsSync(join(repoRoot, path)));

describe("retired claims", () => {
  it("reads the docs, the code and the workflows", () => {
    expect(files).toEqual(
      expect.arrayContaining([
        "docs/deploy.md",
        "LATER.md",
        ".github/workflows/transcribe.yml",
      ])
    );
  });

  // Written as #302's reviews found them.
  it.each([
    "checks the podcast feed every 2 hours and rebuilds",
    "Every 2 hours the feed check deploys only when",
    "so release day means pressing Run workflow",
    "Half an hour after each feed check, Transcribe finds",
  ])("catches %p", (stale) => {
    expect(RETIRED.some(([claim]) => claim.test(stale))).toBe(true);
  });

  it("leaves the backstop's own schedule alone", () => {
    expect(
      RETIRED.some(([claim]) =>
        claim.test("Every 2 hours, on GitHub's schedule (backstop)")
      )
    ).toBe(false);
  });

  it("appear nowhere but the ADRs", () => {
    const found = files.flatMap((path) =>
      readFileSync(join(repoRoot, path), "utf8")
        .split("\n")
        .flatMap((line, i) =>
          RETIRED.flatMap(([claim, now]) => {
            const hit = claim.exec(line);
            return hit ? [`${path}:${i + 1}: "${hit[0]}"; now ${now}`] : [];
          })
        )
    );

    expect(found).toEqual([]);
  });
});
