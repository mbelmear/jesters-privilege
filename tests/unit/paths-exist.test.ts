/**
 * @jest-environment node
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { namedPaths } from "@/lib/named-paths";
import { repoRoot } from "../paths";

// Every repo path the docs and code comments name still exists, so a move or
// a deletion can't leave one pointing nowhere (#246's review found five).
// A glob must match at least one file. A path git ignores counts, since a
// build makes it (public/images, by npm run images). The Jesters' own inputs
// are left as they sent them.

// Every tracked file that can name a path: Markdown, code, workflows, JSON
// config, and the commit hooks, which have no extension. git lists the
// dot-folders (.github, .husky, .claude) a glob skips. Unlike the tests that
// run git in a throwaway repo, this one keeps the GIT_* a commit hook sets:
// they point at this repo, and its index is the one being committed. A file
// deleted but not yet staged names nothing.
const READ =
  /\.(md|ts|tsx|mjs|css|sh|yml|yaml)$|^\.husky\/[^_/]+$|^(package|\.claude\/settings)\.json$/;
const files = execFileSync("git", ["ls-files"], {
  cwd: repoRoot,
  encoding: "utf8",
})
  .split("\n")
  .filter((path) => READ.test(path) && !path.startsWith("docs/inputs/"))
  .filter((path) => existsSync(join(repoRoot, path)));

const ignored = (path: string) =>
  spawnSync("git", ["check-ignore", "--no-index", path, `${path}/`], {
    cwd: repoRoot,
  }).status === 0;

const exists = (path: string) =>
  (path.includes("*")
    ? globSync(path, { cwd: repoRoot }).length > 0
    : existsSync(join(repoRoot, path))) || ignored(path);

describe("named paths", () => {
  it("reads docs, code, workflows and hooks", () => {
    expect(files).toEqual(
      expect.arrayContaining([
        "docs/testing.md",
        "src/app/globals.css",
        ".github/workflows/ci.yml",
        ".husky/pre-commit",
        "package.json",
      ])
    );
  });

  it.each(files)("%s names only paths that exist", (file) => {
    const text = readFileSync(join(repoRoot, file), "utf8");
    // JSON has no comments, so it's read whole, as Markdown is.
    const format = /\.(md|json)$/.test(file) ? "markdown" : "code";
    expect(namedPaths(text, format).filter((path) => !exists(path))).toEqual(
      []
    );
  });
});
