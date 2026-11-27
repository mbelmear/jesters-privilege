/**
 * @jest-environment node
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { repoRoot } from "../paths";

// A pointer such as "(docs/deploy.md, Triggers)" names a section of that
// file, and the section must exist: #302's missing-token error sent a reader
// to docs/deploy.md's "Secrets", which it doesn't have (Credentials), and
// review found it in the second round. A section is a heading, or a bold
// lead ("**Failures are loud.**"), that starts with the name given.
const POINTER =
  /([\w./-]+\.md), ([A-Z][\w'’ -]*?)(?=[),;]| says| above| below)/g;

const files = execFileSync("git", ["ls-files"], {
  cwd: repoRoot,
  encoding: "utf8",
})
  .split("\n")
  .filter((path) => /\.(md|ts|tsx|mjs|yml|yaml|sh)$/.test(path))
  .filter((path) => !path.startsWith("docs/inputs/"))
  .filter((path) => existsSync(join(repoRoot, path)));

const sections = new Map<string, string[]>();
function sectionsOf(path: string) {
  let found = sections.get(path);
  if (!found) {
    found = readFileSync(join(repoRoot, path), "utf8")
      .split("\n")
      .flatMap((line) => {
        const heading = /^#{1,6} (.+)/.exec(line);
        const lead = /^(?:- )?\*\*(.+?)\*\*/.exec(line);
        return heading ? [heading[1]] : lead ? [lead[1]] : [];
      });
    sections.set(path, found);
  }
  return found;
}

// A pointer is written from the repo root, or, in a doc, from its folder
// (docs/deploy.md's "adr/0004-…"); paths-exist.test.ts checks the file.
function target(from: string, named: string) {
  const beside = join(dirname(from), named);
  return existsSync(join(repoRoot, named))
    ? named
    : existsSync(join(repoRoot, beside))
      ? beside
      : undefined;
}

describe("section pointers", () => {
  it("reads docs, code and workflows", () => {
    expect(files).toEqual(
      expect.arrayContaining([
        "docs/deploy.md",
        "src/lib/feed-check-start.ts",
        ".github/workflows/deploy.yml",
      ])
    );
  });

  it("finds a pointer and the section it names", () => {
    const [pointer] = "(docs/deploy.md, Triggers)".matchAll(POINTER);
    expect(pointer?.slice(1)).toEqual(["docs/deploy.md", "Triggers"]);
    expect(sectionsOf("docs/deploy.md")).toContain("Triggers");
    expect(sectionsOf("CODING_STANDARDS.md")).toContain("Failures are loud.");
  });

  it("name only sections their file has", () => {
    const missing = files.flatMap((path) =>
      readFileSync(join(repoRoot, path), "utf8")
        .split("\n")
        .flatMap((line, i) =>
          [...line.matchAll(POINTER)].flatMap(([, named, section]) => {
            const file = target(path, named);
            return file &&
              !sectionsOf(file).some((name) => name.startsWith(section))
              ? [`${path}:${i + 1}: ${named} has no section "${section}"`]
              : [];
          })
        )
    );

    expect(missing).toEqual([]);
  });
});
