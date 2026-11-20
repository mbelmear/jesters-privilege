/**
 * @jest-environment node
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../../../paths";

// The PR gate's tests ask GitHub through FakeGitHub, so `gh` never runs in
// them and never goes on a test's PATH (#250, #164). A stand-in `gh` on a
// child's PATH belongs to a shell script's test, in tests/unit/scripts/:
// #260's first parity test for last-reviewed-sha.sh sat here and wrote one.
const dir = join(repoRoot, "tests", "unit", "lib", "pr-gate");
// Broad on purpose: any PATH, or `gh` named as a string, among these tests is
// worth a look, even in a comment.
const STUBS_GH = [/\bPATH\b/, /["']gh["']/];

describe("the PR gate's tests", () => {
  // Every file, in subfolders too, but this one, which names the patterns.
  const files = readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => path !== __filename)
    .map((path) => path.slice(dir.length + 1));

  it.each(files)("%s reaches GitHub only through the fake", (file) => {
    const text = readFileSync(join(dir, file), "utf8");
    expect(STUBS_GH.filter((pattern) => pattern.test(text))).toEqual([]);
  });
});
