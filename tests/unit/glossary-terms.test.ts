/**
 * @jest-environment node
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../paths";

// Phrases GLOSSARY.md lists under _Avoid_ that have no other use here, each
// with the term to write instead. Bare words with a second meaning stay out:
// "host" (Spreaker, hosting, the Jesters' "Co-host" labels, a bio's
// "co-hosts"), "message", "story". Review still catches those (#281 wrote
// the Jesters as hosts and Submissions as listener messages).
const AVOIDED: [RegExp, string][] = [
  [/\b(?:the|our|three) hosts\b/i, "Jesters"],
  [/\blistener messages?\b/i, "Submission"],
  [/\blistener questions?\b/i, "Question"],
  [/\bmailbag\b/i, "Speak Freely"],
  [/\bcontact form\b/i, "Speak Freely"],
  [/\bfool confessions?\b/i, "Confession"],
  [/\bsubscribe buttons?\b/i, "Listen link"],
  [/\bplatform links?\b/i, "Listen link"],
  [/\btimestamp links?\b/i, "Moment link"],
  [/\bdeep links?\b/i, "Moment link"],
  [/\bjester history\b/i, "Fools' Gallery"],
  [/\bhistory page\b/i, "Fools' Gallery"],
];

// GLOSSARY.md names them to avoid them, the Jesters' inputs stay as they sent
// them, and docs/brief.md is the starting brief docs/spec.md supersedes.
const LEFT_AS_WRITTEN = [
  "GLOSSARY.md",
  "docs/brief.md",
  "tests/unit/glossary-terms.test.ts",
];

const files = execFileSync("git", ["ls-files"], {
  cwd: repoRoot,
  encoding: "utf8",
})
  .split("\n")
  .filter((path) => /\.(md|ts|tsx|yml|yaml)$/.test(path))
  .filter(
    (path) =>
      !path.startsWith("docs/inputs/") && !LEFT_AS_WRITTEN.includes(path)
  )
  .filter((path) => existsSync(join(repoRoot, path)));

describe("GLOSSARY.md's avoided phrases", () => {
  it("reads the docs, the content and the code", () => {
    expect(files).toEqual(
      expect.arrayContaining([
        "README.md",
        "docs/architecture.md",
        "src/content/jesters.ts",
      ])
    );
  });

  it("appear nowhere but GLOSSARY.md and what's left as written", () => {
    const found = files.flatMap((path) =>
      readFileSync(join(repoRoot, path), "utf8")
        .split("\n")
        .flatMap((line, i) =>
          AVOIDED.flatMap(([phrase, instead]) => {
            const hit = phrase.exec(line);
            return hit
              ? [`${path}:${i + 1}: "${hit[0]}", write ${instead}`]
              : [];
          })
        )
    );

    expect(found).toEqual([]);
  });
});
