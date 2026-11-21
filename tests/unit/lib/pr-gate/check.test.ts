/**
 * @jest-environment node
 */
import { join } from "node:path";
import { prGateCheck } from "@/lib/pr-gate/check";
import { firstScreenFiles } from "../../../../scripts/pr-gate-first-screen";
import { scriptsDir } from "../../../paths";
import { git, mainGains, passedAt, throwawayPr } from "./throwaway-pr";

const RUN = "https://github.com/o/r/actions/runs/1";

// A PR whose head has a passed review, closing only what it names.
function setup() {
  const t = throwawayPr("check-");
  t.github.commentBodies = [passedAt(t.head)];
  const gate = {
    ...t.gate,
    firstScreen: firstScreenFiles(join(scriptsDir, "first-screen-files.sh")),
    targetUrl: RUN,
  };
  return { ...t, run: () => prGateCheck(7, gate) };
}

/** The status the check ended on. */
const final = (t: ReturnType<typeof setup>) => t.github.statuses.at(-1);

describe("the PR gate check", () => {
  it("passes a head the passed review names", () => {
    const t = setup();

    expect(t.run()).toBe(0);
    expect(t.github.statuses).toEqual([
      {
        sha: t.head,
        state: "pending",
        description:
          "Checking the review, closing issues and first-screen cost",
        targetUrl: RUN,
      },
      {
        sha: t.head,
        state: "success",
        description: `Reviewed at ${t.head.slice(0, 7)}; closes only what it names; first-screen cost shown or not needed`,
        targetUrl: RUN,
      },
    ]);
  });

  it("refuses a head never reviewed, saying why in its description", () => {
    const t = setup();
    t.github.commentBodies = [];

    expect(t.run()).toBe(0);
    expect(final(t)).toEqual({
      sha: t.head,
      state: "failure",
      // The refusal's first line.
      description: `Refusing to merge #7: head is ${t.head}, but the last passed review is at no commit.`,
      targetUrl: RUN,
    });
    expect(t.err).toEqual([
      `Refusing to merge #7: head is ${t.head}, but the last passed review is at no commit.`,
      `Review it (docs/testing.md, Merging) with origin/main as the fixed point, then: npm run review-passed -- 7 ${t.head}`,
    ]);
  });

  it("refuses a PR that closes an issue it doesn't name", () => {
    const t = setup();
    t.github.prContents.body = "Closes #158.\n\nFix #209 before #145.";
    t.github.prContents.closingIssues = [158, 209];

    t.run();
    expect(final(t)).toEqual({
      sha: t.head,
      state: "failure",
      description:
        "Refusing to merge #7: merging it closes #209, which neither its title names nor its body's first line closes.",
      targetUrl: RUN,
    });
  });

  it("refuses a first-screen change without its cost, cutting the line to 140 characters", () => {
    const t = setup();
    t.github.prContents.files = [
      "src/app/layout.tsx",
      "src/components/site-header.tsx",
      "src/components/site-footer.tsx",
    ];

    t.run();
    expect(final(t)?.state).toBe("failure");
    expect(final(t)?.description).toBe(
      "Refusing to merge #7: it changes src/app/layout.tsx, src/components/site-header.tsx, src/components/site-footer.tsx, and its body has no `n…"
    );
    expect(final(t)?.description).toHaveLength(140);
  });

  it.each(["CONTRIBUTOR", "NONE", "FIRST_TIME_CONTRIBUTOR"] as const)(
    "ignores a passed review posted as %s, without write access",
    (association) => {
      const t = setup();
      t.github.associations[passedAt(t.head)] = association;

      t.run();
      expect(final(t)?.description).toBe(
        `Refusing to merge #7: head is ${t.head}, but the last passed review is at no commit.`
      );
    }
  );

  it.each(["OWNER", "MEMBER", "COLLABORATOR"] as const)(
    "counts a passed review posted as %s",
    (association) => {
      const t = setup();
      t.github.associations[passedAt(t.head)] = association;

      t.run();
      expect(final(t)?.state).toBe("success");
    }
  );

  describe("over a clean merge of main", () => {
    function merged() {
      const t = setup();
      mainGains(t, "other.md", "other\n");
      git(t.dir, "merge", "--quiet", "--no-edit", "origin/main");
      git(t.dir, "push", "--quiet", "origin", "ticket");
      const head = git(t.dir, "rev-parse", "HEAD");
      t.github.pr.head = head;
      const carried = `Code review: passed at ${head} (carried over from ${t.head}: only clean merges of main since)`;
      return { ...t, head, carried };
    }

    it("carries the review over to the new head, recording it", () => {
      const t = merged();

      t.run();
      expect(final(t)).toMatchObject({ sha: t.head, state: "success" });
      expect(t.github.commentBodies.at(-1)).toBe(t.carried);
    });

    // The workflow posts as github-actions[bot], whose association is NONE
    // (recorded: its preview comment on #221, gh 2.103.3, 2026-11-21),
    // so its comment never counts as a review, and each run carries it again.
    it("records it once, however often the check runs", () => {
      const t = merged();
      t.run();
      t.github.associations[t.carried] = "NONE";

      t.run();
      expect(final(t)?.state).toBe("success");
      expect(
        t.github.commentBodies.filter((c) => c === t.carried)
      ).toHaveLength(1);
    });
  });

  // Failures are loud: a read that failed never passes the PR.
  describe("a failed read", () => {
    it("fails the status, naming it, and the run", () => {
      const t = setup();
      // Made up, in the shape a quiet gh read throws (scripts/pr-gate-github.ts).
      t.github.commentsFail = new Error(
        "gh pr view 7 --json=comments: HTTP 502: Bad Gateway\nmore from gh"
      );

      expect(t.run()).toBe(1);
      expect(final(t)).toEqual({
        sha: t.head,
        state: "failure",
        description:
          "Couldn't check #7: gh pr view 7 --json=comments: HTTP 502: Bad Gateway",
        targetUrl: RUN,
      });
      expect(t.err).toEqual([
        "Couldn't check #7: gh pr view 7 --json=comments: HTTP 502: Bad Gateway",
      ]);
    });

    // Unfetched, a clean merge of main looks like a commit of the PR's own,
    // and would read as a missing review rather than as the fetch failing.
    it("fails it when main and the head can't be fetched", () => {
      const t = setup();
      mainGains(t, "other.md", "other\n");
      git(t.dir, "merge", "--quiet", "--no-edit", "origin/main");
      git(t.dir, "push", "--quiet", "origin", "ticket");
      t.github.pr.head = git(t.dir, "rev-parse", "HEAD");
      git(t.dir, "remote", "set-url", "origin", join(t.dir, "nowhere.git"));

      expect(t.run()).toBe(1);
      expect(final(t)).toMatchObject({
        state: "failure",
        description: `Couldn't check #7: couldn't fetch main and ${t.github.pr.head}`,
      });
    });

    it("fails it when the contents can't be read, after the review passed", () => {
      const t = setup();
      t.github.contents = () => {
        // Made up, as the gh adapter's contents read refuses a shape it doesn't know.
        throw new Error("gh pr view gave title as undefined");
      };

      expect(t.run()).toBe(1);
      expect(final(t)?.description).toBe(
        "Couldn't check #7: gh pr view gave title as undefined"
      );
    });
  });
});
