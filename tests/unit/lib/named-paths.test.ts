/**
 * @jest-environment node
 */
import { namedPaths } from "@/lib/named-paths";

describe("namedPaths", () => {
  it("finds repo paths anywhere in Markdown, without trailing punctuation", () => {
    expect(
      namedPaths(
        "Run `scripts/merge-on-green.sh`; see docs/testing.md, then src/lib/feed.ts.",
        "markdown"
      )
    ).toEqual([
      "scripts/merge-on-green.sh",
      "docs/testing.md",
      "src/lib/feed.ts",
    ]);
  });

  it("keeps globs and Next's route brackets", () => {
    expect(
      namedPaths(
        "`tests/unit/scripts/*.test.ts` and src/app/episodes/[...address]/page.tsx",
        "markdown"
      )
    ).toEqual([
      "tests/unit/scripts/*.test.ts",
      "src/app/episodes/[...address]/page.tsx",
    ]);
  });

  it("finds paths in .github and public", () => {
    expect(
      namedPaths("`.github/workflows/ci.yml` serves public/icons/", "markdown")
    ).toEqual([".github/workflows/ci.yml", "public/icons"]);
  });

  it("skips a path that is part of a longer one or a URL", () => {
    expect(
      namedPaths(
        "node_modules/next/dist/docs/x.md and https://example.com/docs/a.md and ../src/a.ts",
        "markdown"
      )
    ).toEqual([]);
  });

  it("skips a pattern cut short by a brace or placeholder", () => {
    expect(
      namedPaths(
        "`src/**/*.test.{ts,tsx}`, `tests/unit/<path>.test.ts`, `docs/${name}.md`",
        "markdown"
      )
    ).toEqual([]);
  });

  it("reads only the comments of code", () => {
    const code = [
      "// Reads src/content/feed.ts (see docs/deploy.md).",
      'const fixture = "src/content/notes.md";',
      "/* scans src/app/globals.css",
      " * and tests/paths.ts */",
      "# a shell comment naming scripts/zizmor.sh",
      'echo "scripts/missing.sh" # but this one: scripts/lint-shell.sh',
    ].join("\n");
    expect(namedPaths(code, "code")).toEqual([
      "src/content/feed.ts",
      "docs/deploy.md",
      "src/app/globals.css",
      "tests/paths.ts",
      "scripts/zizmor.sh",
      "scripts/lint-shell.sh",
    ]);
  });
});
