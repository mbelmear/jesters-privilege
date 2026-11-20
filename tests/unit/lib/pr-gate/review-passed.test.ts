/**
 * @jest-environment node
 */
import { join } from "node:path";
import { reviewPassed } from "@/lib/pr-gate/review-passed";
import { localGit } from "../../../../scripts/pr-gate-git";
import { scriptsDir } from "../../../paths";
import { env, git, mainGains, passedAt, throwawayPr } from "./throwaway-pr";

const USAGE = "Usage: npm run review-passed -- <pr-number> <reviewed full SHA>";

function setup() {
  const t = throwawayPr("review-passed-");
  const failed: unknown[] = [];
  const gate = {
    ...t.gate,
    // Git's own errors on stderr, as the shell script let git print them.
    git: localGit(t.dir, join(scriptsDir, "fetch.sh"), env, t.gate.err),
    failed: (error: unknown) => failed.push(error),
  };
  return {
    ...t,
    failed,
    run: (...args: string[]) => reviewPassed(args, gate),
  };
}

describe("review-passed", () => {
  it.each([
    ["no arguments", []],
    ["only the PR", ["7"]],
    ["a PR that isn't a number", ["#7", "a".repeat(40)]],
    ["a short SHA", ["7", "abc1234"]],
    ["an uppercase SHA", ["7", "A".repeat(40)]],
    ["a third argument", ["7", "a".repeat(40), "--yes"]],
  ])("prints its usage and exits 2 on %s", async (_, args) => {
    const t = setup();

    expect(await t.run(...args)).toBe(2);
    expect(t.err).toEqual([USAGE]);
    expect(t.github.commentBodies).toEqual([]);
  });

  it("records a review of the head", async () => {
    const t = setup();

    expect(await t.run("7", t.head)).toBe(0);
    expect(t.github.commentBodies).toEqual([passedAt(t.head)]);
    expect(t.err).toEqual([]);
    expect(t.out).toEqual([]);
  });

  // gh printed its error, and the shell script ended with gh's exit code:
  // the caller's to give (scripts/review-passed.ts).
  it("leaves a failed comment to the caller", async () => {
    const t = setup();
    // Made up: what execFileSync throws when gh exits 4.
    const error = Object.assign(new Error("Command failed: gh pr comment 7"), {
      status: 4,
    });
    jest.spyOn(t.github, "comment").mockImplementation(() => {
      throw error;
    });

    await expect(t.run("7", t.head)).rejects.toBe(error);
    expect(t.err).toEqual([]);
  });

  describe("the head", () => {
    // What wait-pushed-head.sh said; review-passed.sh added nothing to it.
    it("refuses once GitHub still shows another commit after a minute", async () => {
      const t = setup();
      const local = t.commit("ticket.md", "unpushed\n", "Unpushed");

      expect(await t.run("7", local)).toBe(1);
      expect(t.err).toEqual([
        `#7 is at ${t.head.slice(0, 7)} on GitHub, but ticket here is at ${local.slice(0, 7)}; push or pull until they match.`,
      ]);
      expect(t.clock.slept).toEqual(Array(11).fill(5));
      expect(t.github.commentBodies).toEqual([]);
    });

    it("waits for GitHub to show the commit just pushed", async () => {
      const t = setup();
      const local = t.commit("ticket.md", "pushed\n", "Pushed");
      t.clock.onSleep = () => {
        t.github.pr.head = local;
      };

      expect(await t.run("7", local)).toBe(0);
      expect(t.github.commentBodies).toEqual([passedAt(local)]);
    });

    // gh printed its own error, and the shell script exited 1 without a word
    // of its own, whether the first read failed or one during the wait.
    it.each([
      ["the first read", 0],
      ["a read during the wait", 1],
    ])(
      "exits 1 when %s fails, leaving the error to the caller",
      async (_, ok) => {
        const t = setup();
        const local = t.commit("ticket.md", "unpushed\n", "Unpushed");
        // Made up: what execFileSync throws when gh exits 1.
        const error = new Error("Command failed: gh pr view 7\nHTTP 502");
        let reads = 0;
        jest.spyOn(t.github, "pullRequest").mockImplementation(() => {
          reads += 1;
          if (reads > ok) throw error;
          return { ...t.github.pr };
        });

        expect(await t.run("7", local)).toBe(1);
        expect(t.failed).toEqual([error]);
        expect(t.err).toEqual([]);
        expect(t.github.commentBodies).toEqual([]);
      }
    );
  });

  describe("a review of a commit before the head", () => {
    /** Merges origin/main into `ticket` and pushes, keeping the PR's side of any conflict, as GitHub then shows. */
    function mergeMain(t: ReturnType<typeof setup>) {
      git(t.dir, "merge", "--quiet", "--no-edit", "-X", "ours", "origin/main");
      git(t.dir, "push", "--quiet", "origin", "ticket");
      t.github.pr.head = git(t.dir, "rev-parse", "HEAD");
      return t.github.pr.head;
    }

    // merge and mark-ready carry it over to the head, as they do any review.
    it("records the reviewed commit when only a clean merge of main follows it", async () => {
      const t = setup();
      mainGains(t, "other.md", "other\n");
      mergeMain(t);

      expect(await t.run("7", t.head)).toBe(0);
      expect(t.github.commentBodies).toEqual([passedAt(t.head)]);
      expect(t.err).toEqual([]);
    });

    it("refuses when the merge of main touches the PR's files, naming the lighter review", async () => {
      const t = setup();
      mainGains(t, "ticket.md", "main's line\n");
      const head = mergeMain(t);

      expect(await t.run("7", t.head)).toBe(1);
      expect(t.err).toEqual([
        `Refusing: #7's head is ${head}, and a merge since ${t.head} changes the PR's files. Review it with ${t.head} as the fixed point (docs/testing.md, Merging: a merge of main that changes the PR's files), then record that review at ${head}.`,
      ]);
      expect(t.github.commentBodies).toEqual([]);
    });

    it("refuses when a commit of the PR's own follows the review", async () => {
      const t = setup();
      const head = t.commit("ticket.md", "a fix\n", "A fix");
      git(t.dir, "push", "--quiet", "origin", "ticket");
      t.github.pr.head = head;

      expect(await t.run("7", t.head)).toBe(1);
      expect(t.err).toEqual([
        `Refusing: #7's head is ${head}, but the review was of ${t.head}. Review the new commits first.`,
      ]);
      expect(t.github.commentBodies).toEqual([]);
    });

    // Taken from review-passed.sh on 2026-11-20: git's line, then the refusal.
    it("refuses a commit git doesn't know, saying git's error", async () => {
      const t = setup();
      const unknown = "1".repeat(40);

      expect(await t.run("7", unknown)).toBe(1);
      expect(t.err).toEqual([
        `fatal: Not a valid commit name ${unknown}`,
        `Refusing: #7's head is ${t.head}, but the review was of ${unknown}. Review the new commits first.`,
      ]);
    });

    // As review-passed.sh ended on 2026-11-20 (a failed fetch's lines first),
    // but for git's three-line error, which it printed twice, reading the
    // commits again to pick its message; the gate reads them once.
    it("names the merge when git can't read main, saying git's error", async () => {
      const t = setup();
      mainGains(t, "other.md", "other\n");
      const head = mergeMain(t);
      git(t.dir, "update-ref", "-d", "refs/remotes/origin/main");
      const nowhere = join(t.dir, "nowhere.git");
      git(t.dir, "remote", "set-url", "origin", nowhere);

      expect(await t.run("7", t.head)).toBe(1);
      expect(t.err.slice(-4)).toEqual([
        "fatal: ambiguous argument 'origin/main': unknown revision or path not in the working tree.",
        "Use '--' to separate paths from revisions, like this:",
        "'git <command> [<revision>...] -- [<file>...]'",
        `Refusing: #7's head is ${head}, and a merge since ${t.head} changes the PR's files. Review it with ${t.head} as the fixed point (docs/testing.md, Merging: a merge of main that changes the PR's files), then record that review at ${head}.`,
      ]);
      expect(t.err).toHaveLength(10);
      expect(t.github.commentBodies).toEqual([]);
    });

    // Taken from review-passed.sh on 2026-11-20: git's lines, its blank one
    // included, then the warning, and it goes on with what's here.
    it("says when it can't fetch, and checks what's here", async () => {
      const t = setup();
      mainGains(t, "other.md", "other\n");
      const head = mergeMain(t);
      const nowhere = join(t.dir, "nowhere.git");
      git(t.dir, "remote", "set-url", "origin", nowhere);

      expect(await t.run("7", t.head)).toBe(0);
      expect(t.err).toEqual([
        `fatal: '${nowhere}' does not appear to be a git repository`,
        "fatal: Could not read from remote repository.",
        "",
        "Please make sure you have the correct access rights",
        "and the repository exists.",
        `Couldn't fetch main and ${head}; checking what's here.`,
      ]);
      expect(t.github.commentBodies).toEqual([passedAt(t.head)]);
    });
  });
});
