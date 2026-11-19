/**
 * @jest-environment node
 */
import { spawnSync } from "node:child_process";
import { existsSync, globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { namedPaths } from "@/lib/named-paths";
import { repoRoot } from "../paths";

// Every repo path the docs and code comments name still exists, so a move or
// a deletion can't leave one pointing nowhere (#246's review found five).
// A glob must match at least one file. A path git ignores counts, since a
// build makes it (public/images, by npm run images). The Jesters' own inputs
// are left as they sent them.
const files = globSync("**/*.{md,ts,tsx,mjs,css,sh,yml,yaml}", {
  cwd: repoRoot,
  exclude: (path) =>
    /^(node_modules|\.next|out|coverage|playwright-report|test-results|\.lighthouseci|docs\/inputs)$/.test(
      path
    ),
}).sort();

const ignored = (path: string) =>
  spawnSync("git", ["check-ignore", "--no-index", path, `${path}/`], {
    cwd: repoRoot,
  }).status === 0;

const exists = (path: string) =>
  (path.includes("*")
    ? globSync(path, { cwd: repoRoot }).length > 0
    : existsSync(join(repoRoot, path))) || ignored(path);

describe("named paths", () => {
  it("finds files to read", () => {
    expect(files).toContain("docs/testing.md");
    expect(files).toContain("src/app/globals.css");
  });

  it.each(files)("%s names only paths that exist", (file) => {
    const text = readFileSync(join(repoRoot, file), "utf8");
    const format = file.endsWith(".md") ? "markdown" : "code";
    expect(namedPaths(text, format).filter((path) => !exists(path))).toEqual(
      []
    );
  });
});
