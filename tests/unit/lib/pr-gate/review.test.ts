/**
 * @jest-environment node
 */
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { lastReviewed, requireReview } from "@/lib/pr-gate/review";
import { scriptsDir } from "../../../paths";
import { git, mainGains, throwawayPr } from "./throwaway-pr";

const passedAt = (sha: string) => `Code review: passed at ${sha}`;

// A PR on `ticket` whose head has a passed review.
function setup() {
  const t = throwawayPr("review-");
  t.github.commentBodies = [passedAt(t.head)];
  const run = (head: string) => {
    try {
      requireReview(7, head, "merge", t.gate);
      return [];
    } catch (error) {
      return String((error as Error).message).split("\n");
    }
  };
  return { ...t, run };
}

/** Merges origin/main into `ticket` and pushes, keeping the PR's side of any conflict. */
function mergeMain(t: ReturnType<typeof setup>) {
  git(t.dir, "merge", "--quiet", "--no-edit", "-X", "ours", "origin/main");
  git(t.dir, "push", "--quiet", "origin", "ticket");
  return git(t.dir, "rev-parse", "HEAD");
}

describe("the review rule", () => {
  it("passes the head the review names, recording nothing", () => {
    const t = setup();

    expect(t.run(t.head)).toEqual([]);
    expect(t.github.commentBodies).toEqual([passedAt(t.head)]);
  });

  it("carries the review over a clean merge of main, and records it", () => {
    const t = setup();
    mainGains(t, "other.md", "other\n");
    const head = mergeMain(t);

    expect(t.run(head)).toEqual([]);
    // The post-merge audit reads this comment as a review of the final head.
    expect(t.github.commentBodies.at(-1)).toBe(
      `Code review: passed at ${head} (carried over from ${t.head}: only clean merges of main since)`
    );
  });

  it("sees main as it is now, not as this clone last fetched it", () => {
    const t = setup();
    const before = git(t.dir, "rev-parse", "origin/main");
    mainGains(t, "other.md", "other\n");
    const head = mergeMain(t);
    git(t.dir, "update-ref", "refs/remotes/origin/main", before);

    expect(t.run(head)).toEqual([]);
  });

  it("says when it can't fetch, and checks what's here", () => {
    const t = setup();
    mainGains(t, "other.md", "other\n");
    const head = mergeMain(t);
    git(t.dir, "remote", "set-url", "origin", join(t.dir, "nowhere.git"));

    expect(t.run(head)).toEqual([]);
    expect(t.err).toEqual([
      `Couldn't fetch main and ${head}; checking what's here.`,
    ]);
  });

  it("refuses a merge that touches the PR's files, naming the fixed point", () => {
    const t = setup();
    mainGains(t, "ticket.md", "main's line\n");
    const head = mergeMain(t);

    expect(t.run(head)).toEqual([
      `Refusing to merge #7: head is ${head}, but the last passed review is at ${t.head}.`,
      `Review it (docs/testing.md, Merging) with ${t.head} as the fixed point, then: npm run review-passed -- 7 ${head}`,
    ]);
    expect(t.github.commentBodies).toEqual([passedAt(t.head)]);
  });

  it("refuses a commit of the PR's own after the review", () => {
    const t = setup();
    const head = t.commit("ticket.md", "a fix\n", "A fix");

    expect(t.run(head)[0]).toContain(`head is ${head}`);
    expect(t.github.commentBodies).toEqual([passedAt(t.head)]);
  });

  it("refuses a head never reviewed, from main", () => {
    const t = setup();
    t.github.commentBodies = [];

    expect(t.run(t.head)).toEqual([
      `Refusing to merge #7: head is ${t.head}, but the last passed review is at no commit.`,
      `Review it (docs/testing.md, Merging) with origin/main as the fixed point, then: npm run review-passed -- 7 ${t.head}`,
    ]);
  });

  it("reviews from main when a rebase dropped the reviewed commit", () => {
    const t = setup();
    mainGains(t, "other.md", "other\n");
    git(t.dir, "rebase", "--quiet", "origin/main");
    const head = git(t.dir, "rev-parse", "HEAD");

    expect(t.run(head)[1]).toContain("with origin/main as the fixed point");
  });
});

// scripts/last-reviewed-sha.sh reads reviews for the post-merge audit, which
// installs nothing, so it stays shell; this holds it to the gate's reading.
describe("the passed-review line", () => {
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
