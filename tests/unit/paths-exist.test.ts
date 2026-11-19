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

// Git run from a hook inherits GIT_DIR and GIT_INDEX_FILE (merge-holds-branch
// tells that story), so git here drops them.
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (name.startsWith("GIT_")) delete env[name];
}

// Every tracked file that can name a path: Markdown, code, workflows, and the
// commit hooks, which have no extension. git lists dot-folders (.github,
// .husky) that a glob skips.
const READ = /\.(md|ts|tsx|mjs|css|sh|yml|yaml)$|^\.husky\/[^_/]+$/;
const files = execFileSync("git", ["ls-files"], {
  cwd: repoRoot,
  env,
  encoding: "utf8",
})
  .split("\n")
  .filter((path) => READ.test(path) && !path.startsWith("docs/inputs/"));

const ignored = (path: string) =>
  spawnSync("git", ["check-ignore", "--no-index", path, `${path}/`], {
    cwd: repoRoot,
    env,
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
      ])
    );
  });

  it.each(files)("%s names only paths that exist", (file) => {
    const text = readFileSync(join(repoRoot, file), "utf8");
    const format = file.endsWith(".md") ? "markdown" : "code";
    expect(namedPaths(text, format).filter((path) => !exists(path))).toEqual(
      []
    );
  });
});
