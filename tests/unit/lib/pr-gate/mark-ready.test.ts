/**
 * @jest-environment node
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { markReady } from "@/lib/pr-gate/mark-ready";
import { firstScreenFiles } from "../../../../scripts/pr-gate-first-screen";
import { scriptsDir } from "../../../paths";
import { git, mainGains, throwawayPr } from "./throwaway-pr";

const passedAt = (sha: string) => `Code review: passed at ${sha}`;

const previewOf = (sha: string) =>
  `<!-- deploy-preview -->\n**Preview:** https://pr-7.example.workers.dev\n\nBuilt from ${sha}.`;

// A PR whose head has a passed review, passing checks, and a preview built
// from it, unless a test says otherwise.
function setup() {
  const t = throwawayPr("mark-ready-");
  t.github.checkList = [
    { name: "Lint workflows", state: "pass", link: "" },
    { name: "Preview URL", state: "pass", link: "" },
  ];
  t.github.commentBodies = [passedAt(t.head), previewOf(t.head)];
  const gate = {
    ...t.gate,
    firstScreen: firstScreenFiles(join(scriptsDir, "first-screen-files.sh")),
  };
  return { ...t, run: () => markReady(7, gate) };
}

describe("mark-ready", () => {
  it("labels a reviewed PR whose checks pass and that merges cleanly", async () => {
    const t = setup();

    expect(await t.run()).toBe(0);
    expect(t.github.labels).toEqual(["ready-for-human"]);
    // pr-status's report, on stderr, as the wait goes.
    expect(t.err).toEqual([
      `#7 at ${t.head.slice(0, 7)}`,
      "Lint workflows\tpass",
      "Preview URL\tpass",
      "Preview: https://pr-7.example.workers.dev",
      "Merges cleanly with main: yes",
    ]);
    expect(t.out).toEqual([]);
  });

  it("refuses a head GitHub doesn't show yet", async () => {
    const t = setup();
    writeFileSync(join(t.dir, "ticket.md"), "more\n");
    git(t.dir, "commit", "--quiet", "-am", "Unpushed");
    const local = git(t.dir, "rev-parse", "HEAD");

    expect(await t.run()).toBe(1);
    expect(t.err).toEqual([
      `#7 is at ${t.head.slice(0, 7)} on GitHub, but ticket here is at ${local.slice(0, 7)}; push or pull until they match.`,
      "Refusing to label #7: GitHub doesn't show this checkout's commit (see above).",
    ]);
    expect(t.github.labels).toEqual([]);
  });

  // Each before the wait, so it fails in seconds, not minutes.
  describe("refuses before the wait", () => {
    it("a head without a passed review", async () => {
      const t = setup();
      t.github.commentBodies = [previewOf(t.head)];

      expect(await t.run()).toBe(1);
      expect(t.err[0]).toBe(
        `Refusing to label #7: head is ${t.head}, but the last passed review is at no commit.`
      );
      expect(t.clock.slept).toEqual([]);
      expect(t.github.labels).toEqual([]);
    });

    it("a PR that would close an issue it doesn't name", async () => {
      const t = setup();
      t.github.prContents.body = "Closes #158.\n\n- Fix #209 before #145.";
      t.github.prContents.closingIssues = [158, 209];

      expect(await t.run()).toBe(1);
      expect(t.err[0]).toBe(
        "Refusing to label #7: merging it closes #209, which neither its title names nor its body's first line closes."
      );
      expect(t.github.labels).toEqual([]);
    });

    it("a first-screen change without its cost", async () => {
      const t = setup();
      t.github.prContents.files = ["src/app/layout.tsx"];

      expect(await t.run()).toBe(1);
      expect(t.err[0]).toBe(
        "Refusing to label #7: it changes src/app/layout.tsx, and its body has no `npm run lighthouse:compare` output."
      );
      expect(t.github.labels).toEqual([]);
    });

    it("in that order: the review first", async () => {
      const t = setup();
      t.github.commentBodies = [];
      t.github.prContents.closingIssues = [209];
      t.github.prContents.files = ["src/app/layout.tsx"];

      expect(await t.run()).toBe(1);
      expect(t.err[0]).toContain("the last passed review is at no commit");
    });

    it("then the issues it closes", async () => {
      const t = setup();
      t.github.prContents.closingIssues = [209];
      t.github.prContents.files = ["src/app/layout.tsx"];

      expect(await t.run()).toBe(1);
      expect(t.err[0]).toContain("merging it closes #209");
    });
  });

  it("carries a review over a clean merge of main, then labels", async () => {
    const t = setup();
    mainGains(t, "other.md", "other\n");
    git(t.dir, "merge", "--quiet", "--no-edit", "origin/main");
    git(t.dir, "push", "--quiet", "origin", "ticket");
    const head = git(t.dir, "rev-parse", "HEAD");
    t.github.pr.head = head;
    t.github.commentBodies.push(previewOf(head));

    expect(await t.run()).toBe(0);
    expect(t.github.commentBodies).toContain(
      `Code review: passed at ${head} (carried over from ${t.head}: only clean merges of main since)`
    );
    expect(t.github.labels).toEqual(["ready-for-human"]);
  });

  it("refuses when a check fails", async () => {
    const t = setup();
    t.github.checkList.push({ name: "Build", state: "fail", link: "" });
    t.github.main.Build = "success";

    expect(await t.run()).toBe(1);
    expect(t.err).toContain("Build\tfail");
    expect(t.err.at(-1)).toBe(
      "Refusing to label #7: pr-status didn't pass (see above)."
    );
    expect(t.github.labels).toEqual([]);
  });

  it("refuses a PR that isn't open", async () => {
    const t = setup();
    t.github.pr.state = "MERGED";

    expect(await t.run()).toBe(1);
    expect(t.err).toEqual([
      "#7 is MERGED; nothing to wait for.",
      "Refusing to label #7: pr-status didn't pass (see above).",
    ]);
  });

  it("refuses when it conflicts with main", async () => {
    const t = setup();
    mainGains(t, "ticket.md", "main's own\n");

    expect(await t.run()).toBe(1);
    expect(t.err.at(-1)).toBe(
      "Refusing to label #7: pr-status didn't pass (see above)."
    );
  });

  it("refuses without a preview built from its head", async () => {
    const t = setup();
    t.github.commentBodies = [passedAt(t.head), previewOf("b".repeat(40))];

    expect(await t.run()).toBe(1);
    expect(t.err.at(-1)).toBe(
      "Refusing to label #7: no preview built from its head yet."
    );
    expect(t.github.labels).toEqual([]);
  });

  it("refuses when the preview job was skipped", async () => {
    const t = setup();
    t.github.checkList[1] = {
      name: "Preview URL",
      state: "skipping",
      link: "",
    };

    expect(await t.run()).toBe(1);
    expect(t.err.at(-1)).toBe(
      "Refusing to label #7: no preview built from its head yet."
    );
  });

  it("refuses a head that moved while checks ran", async () => {
    const t = setup();
    t.github.checkList[0] = {
      name: "Lint workflows",
      state: "pending",
      link: "",
    };
    t.clock.onSleep = () => {
      t.github.checkList[0] = {
        name: "Lint workflows",
        state: "pass",
        link: "",
      };
      t.github.pr.head = "c".repeat(40);
    };

    expect(await t.run()).toBe(1);
    expect(t.err.at(-1)).toBe(
      "Refusing to label #7: its head moved while checks ran; run it again."
    );
    expect(t.github.labels).toEqual([]);
  });
});
