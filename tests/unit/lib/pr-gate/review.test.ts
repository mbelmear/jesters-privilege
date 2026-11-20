/**
 * @jest-environment node
 */
import { join } from "node:path";
import { requireReview } from "@/lib/pr-gate/review";
import { refusalLines } from "./refusal-lines";
import { git, mainGains, passedAt, throwawayPr } from "./throwaway-pr";

// A PR on `ticket` whose head has a passed review.
function setup() {
  const t = throwawayPr("review-");
  t.github.commentBodies = [passedAt(t.head)];
  const run = (head: string) =>
    refusalLines(() => requireReview(7, head, "merge", t.gate));
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
