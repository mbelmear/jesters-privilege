/**
 * @jest-environment node
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { repoRoot } from "../../../paths";

// The PR gate's tests ask GitHub through FakeGitHub, so `gh` never runs in
// them and never goes on a test's PATH (#250, #164). A stand-in `gh` on a
// child's PATH belongs to a shell script's test, in tests/unit/scripts/:
// #260's first parity test for last-reviewed-sha.sh sat here and wrote one.
const dir = join(repoRoot, "tests", "unit", "lib", "pr-gate");
const STUBS_GH = [/\bPATH\b/, /["']gh["']/];

describe("the PR gate's tests", () => {
  const files = readdirSync(dir).filter(
    (file) => file !== basename(__filename)
  );

  it.each(files)("%s reaches GitHub only through the fake", (file) => {
    const text = readFileSync(join(dir, file), "utf8");
    expect(STUBS_GH.filter((pattern) => pattern.test(text))).toEqual([]);
  });
});
