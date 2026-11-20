/**
 * @jest-environment node
 */
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { lastReviewed } from "@/lib/pr-gate/review";
import { scriptsDir } from "../../paths";

const passedAt = (sha: string) => `Code review: passed at ${sha}`;

// scripts/last-reviewed-sha.sh reads reviews for the post-merge audit, which
// installs nothing, so it stays shell; this holds it to the PR gate's reading
// (src/lib/pr-gate/review.ts), on the same comments.
describe("last-reviewed-sha.sh and the PR gate", () => {
  const a = "a".repeat(40);
  const b = "b".repeat(40);
  const c = "c".repeat(40);

  // What the script prints for these comments, gh answering from a fixture
  // through the real jq, as gh does with the script's --jq.
  function script(comments: string[]): string {
    const root = mkdtempSync(join(tmpdir(), "last-reviewed-"));
    try {
      const fixture = join(root, "pr.json");
      writeFileSync(
        fixture,
        JSON.stringify({ comments: comments.map((body) => ({ body })) })
      );
      writeFileSync(
        join(root, "gh"),
        `#!/bin/bash
filter="."
while (($#)); do
  [[ $1 == --jq ]] && { filter=$2; shift; }
  shift
done
jq -r "$filter" "${fixture}"
`
      );
      chmodSync(join(root, "gh"), 0o755);
      return spawnSync(
        "bash",
        [join(scriptsDir, "last-reviewed-sha.sh"), "7"],
        {
          env: {
            ...process.env,
            PATH: `${root}${delimiter}${process.env.PATH}`,
          },
          encoding: "utf8",
        }
      ).stdout.trim();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  it.each([
    ["no comments", [], undefined],
    ["no review", ["Looks good"], undefined],
    ["one review", [passedAt(a)], a],
    ["the newest of two", [passedAt(a), "Looks good", passedAt(b)], b],
    [
      "a carried-over review",
      [
        passedAt(a),
        `Code review: passed at ${b} (carried over from ${a}: only clean merges of main since)`,
      ],
      b,
    ],
    ["a line inside a comment", [`Notes\n${passedAt(a)}\nmore`], a],
    [
      "the last of two in one comment",
      [`${passedAt(a)}\n${passedAt(b)}`, "x"],
      b,
    ],
    ["not a line's start", [`Said: ${passedAt(a)}`], undefined],
    ["a short SHA", ["Code review: passed at abc1234"], undefined],
    ["capitals", [`Code review: passed at ${c.toUpperCase()}`], undefined],
  ])("reads %s the same way", (_, comments, sha) => {
    expect(lastReviewed(comments)).toBe(sha);
    expect(script(comments)).toBe(sha ?? "");
  });
});
