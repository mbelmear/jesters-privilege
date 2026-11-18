/**
 * @jest-environment node
 */
import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ContentValue } from "@/lib/content";
import { content } from "@/content";
import { repoRoot } from "../../paths";

// Draft copy waits on a Jester's approval, so nothing outside content files
// may fix its wording (CODING_STANDARDS.md, Content):
// - docs/spec.md quoting it makes it read as final (AGENTS.md, Content);
// - a test spelling it out breaks when a Jester rewords it.
// #243's first review found both, and the reviewer missed the spec quotes.

const read = (path: string) => readFileSync(join(repoRoot, path), "utf8");

// Every string in the content, split by whether a draft record holds it.
function contentStrings(
  value: ContentValue,
  inDraft = false,
  found = { draft: new Set<string>(), final: new Set<string>() }
) {
  if (typeof value === "string") {
    (inDraft ? found.draft : found.final).add(value);
  } else if (Array.isArray(value)) {
    const items: readonly ContentValue[] = value;
    for (const item of items) contentStrings(item, inDraft, found);
  } else if (typeof value === "object" && value !== null) {
    const draft = inDraft || ("draft" in value && value.draft === true);
    for (const item of Object.values(value)) contentStrings(item, draft, found);
  }
  return found;
}

const { draft, final } = contentStrings(content);
// Words a final record also holds can't be told apart in a test: the
// Transcript's final "Play from" stays readable as plain text.
const draftOnly = [...draft].filter((text) => !final.has(text));
const quotes = ['"', "'", "`", "“"];

// The draft texts that open a quoted string somewhere in a file.
function quotedDrafts(text: string, drafts: readonly string[]): string[] {
  return drafts.filter((copy) =>
    quotes.some((quote) => text.includes(quote + copy))
  );
}

describe("draft copy", () => {
  it("is found, so these checks have something to check", () => {
    expect(draft.size).toBeGreaterThan(0);
  });

  it("isn't quoted in docs/spec.md, which would make it final", () => {
    expect(quotedDrafts(read("docs/spec.md"), [...draft])).toEqual([]);
  });

  const tests = globSync("tests/**/*.{ts,tsx}", { cwd: repoRoot })
    .filter((path) => !path.endsWith("draft-copy.test.ts"))
    .sort();

  it("finds the test files", () => {
    expect(tests).toContain("tests/e2e/player.spec.ts");
  });

  it.each(tests)("isn't spelled out in %s; read it from content", (path) => {
    expect(quotedDrafts(read(path), draftOnly)).toEqual([]);
  });
});
