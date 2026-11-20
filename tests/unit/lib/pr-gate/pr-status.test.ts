/**
 * @jest-environment node
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FakeGitHub } from "@/lib/pr-gate/fake-github";
import { localGit } from "@/lib/pr-gate/git";
import { prStatus } from "@/lib/pr-gate/pr-status";
import { fakeClock } from "@/lib/pr-gate/waits";
import { scriptsDir } from "../../../paths";

// Git run from a hook inherits GIT_DIR and GIT_INDEX_FILE, which point every
// git command at the real repository (merge-holds-branch.test.ts), so every
// git here drops them.
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (name.startsWith("GIT_")) delete env[name];
}
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

let root = "";
afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
  root = "";
});

// A throwaway origin with main, and a clone on the PR's branch `ticket`, one
// commit ahead and pushed. GitHub (the fake) shows that commit as the PR's
// head, open, with every check passed and its preview skipped, unless a test
// says otherwise.
function setup() {
  root = mkdtempSync(join(tmpdir(), "pr-status-"));
  const origin = join(root, "origin.git");
  const dir = join(root, "clone");
  git(root, "init", "--quiet", "--bare", "--initial-branch=main", origin);
  git(root, "clone", "--quiet", origin, dir);
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "user.name", "Test");
  writeFileSync(join(dir, "deploy.md"), "top\nmiddle\nbottom\n");
  git(dir, "add", "-A");
  git(dir, "commit", "--quiet", "-m", "Main");
  git(dir, "push", "--quiet", "origin", "main");
  git(dir, "switch", "--quiet", "-c", "ticket");
  writeFileSync(join(dir, "ticket.md"), "the ticket\n");
  git(dir, "add", "-A");
  git(dir, "commit", "--quiet", "-m", "Ticket");
  git(dir, "push", "--quiet", "origin", "ticket");
  const head = git(dir, "rev-parse", "HEAD");

  const github = new FakeGitHub({ state: "OPEN", branch: "ticket", head });
  github.checkList = [
    { name: "Lint workflows", state: "pass", link: "" },
    { name: "Preview URL", state: "skipping", link: "" },
  ];
  const clock = fakeClock();
  const out: string[] = [];
  const err: string[] = [];
  const run = () =>
    prStatus(7, {
      github,
      git: localGit(dir, join(scriptsDir, "fetch.sh"), env),
      clock,
      out: (line) => out.push(line),
      err: (line) => err.push(line),
    });
  return { dir, head, github, clock, out, err, run };
}

describe("pr-status", () => {
  it("has nothing to wait for on a closed PR", async () => {
    const t = setup();
    t.github.pr.state = "CLOSED";

    expect(await t.run()).toBe(1);
    expect(t.out).toEqual(["#7 is CLOSED; nothing to wait for."]);
  });

  it("reports every check, a skipped preview, and a clean merge", async () => {
    const t = setup();

    expect(await t.run()).toBe(0);
    expect(t.out).toEqual([
      `#7 at ${t.head.slice(0, 7)}`,
      "Lint workflows\tpass",
      "Preview URL\tskipping",
      "Preview: none, its job was skipped",
      "Merges cleanly with main: yes",
    ]);
    expect(t.clock.slept).toEqual([]);
  });

  it("waits for checks to appear, then for pending ones to finish", async () => {
    const t = setup();
    const finished = t.github.checkList;
    t.github.checkList = [];
    t.clock.onSleep = () => {
      t.github.checkList =
        t.clock.slept.length === 1
          ? [{ name: "Lint workflows", state: "pending", link: "" }]
          : finished;
    };

    expect(await t.run()).toBe(0);
    expect(t.out).toContain("Lint workflows\tpass");
    expect(t.out.join("\n")).not.toContain("pending");
    expect(t.clock.slept).toEqual([5, 60]);
  });

  it("refuses when no check appears", async () => {
    const t = setup();
    t.github.checkList = [];

    expect(await t.run()).toBe(1);
    expect(t.err).toEqual([
      "No checks reported on #7 yet; wait for CI to start, then run this again.",
    ]);
    expect(t.clock.slept).toEqual(Array(29).fill(5));
  });

  it("reads the checks through a dropped connection", async () => {
    const t = setup();
    t.github.dropped = 2;

    expect(await t.run()).toBe(0);
    expect(t.out).toContain("Lint workflows\tpass");
  });

  it("gives up after half an hour without GitHub", async () => {
    const t = setup();
    t.clock.onSleep = () => {
      if (t.clock.slept.length === 1) t.github.dropped = Infinity;
    };
    t.github.checkList = [{ name: "Build", state: "pending", link: "" }];

    expect(await t.run()).toBe(1);
    expect(t.err).toEqual([
      "Couldn't reach GitHub to read #7's checks after 30 tries. Run this again once it's back.",
    ]);
    expect(t.clock.slept.filter((s) => s === 60)).toHaveLength(30);
  });

  it("waits for GitHub to show the commit checked out here, then refuses", async () => {
    const t = setup();
    writeFileSync(join(t.dir, "ticket.md"), "more\n");
    git(t.dir, "commit", "--quiet", "-am", "Unpushed");
    const local = git(t.dir, "rev-parse", "HEAD");

    expect(await t.run()).toBe(1);
    expect(t.err).toEqual([
      `#7 is at ${t.head.slice(0, 7)} on GitHub, but ticket here is at ${local.slice(0, 7)}; push or pull until they match.`,
    ]);
    expect(t.clock.slept).toEqual(Array(11).fill(5));
  });

  it("reads the commit pushed during the wait", async () => {
    const t = setup();
    writeFileSync(join(t.dir, "ticket.md"), "more\n");
    git(t.dir, "commit", "--quiet", "-am", "Pushed late");
    const local = git(t.dir, "rev-parse", "HEAD");
    t.clock.onSleep = () => {
      git(t.dir, "push", "--quiet", "origin", "ticket");
      t.github.pr.head = local;
    };

    expect(await t.run()).toBe(0);
    expect(t.out[0]).toBe(`#7 at ${local.slice(0, 7)}`);
  });

  it("says it can't tell whether it merges cleanly when the fetch fails", async () => {
    const t = setup();
    git(t.dir, "remote", "set-url", "origin", join(t.dir, "nowhere.git"));

    expect(await t.run()).toBe(1);
    expect(t.out.at(-1)).toBe(
      "Merges cleanly with main: unknown (couldn't fetch)"
    );
  });

  it("says so before the wait when it already conflicts with main", async () => {
    const t = setup();
    git(t.dir, "switch", "--quiet", "main");
    writeFileSync(join(t.dir, "ticket.md"), "main's own\n");
    git(t.dir, "add", "-A");
    git(t.dir, "commit", "--quiet", "-m", "Conflicting");
    git(t.dir, "push", "--quiet", "origin", "main");
    git(t.dir, "switch", "--quiet", "ticket");

    expect(await t.run()).toBe(1);
    expect(t.out).toEqual([
      `#7 at ${t.head.slice(0, 7)}`,
      "Merges cleanly with main: no (CONFLICTING); merge origin/main in and push first.",
    ]);
    expect(t.clock.slept).toEqual([]);
  });

  describe("a preview job that ran", () => {
    const ran = (t: ReturnType<typeof setup>) => {
      t.github.checkList = [{ name: "Preview URL", state: "pass", link: "" }];
    };
    const comment = (sha: string) =>
      `<!-- deploy-preview -->\n**Preview:** https://pr-7.example.workers.dev\n\nBuilt from ${sha}.`;

    it("waits for the comment naming the head, and reports its URL", async () => {
      const t = setup();
      ran(t);
      t.github.commentBodies = ["Looks good", comment("b".repeat(40))];
      t.clock.onSleep = () => {
        t.github.commentBodies.push(comment(t.head));
      };

      expect(await t.run()).toBe(0);
      expect(t.out).toContain("Preview: https://pr-7.example.workers.dev");
      expect(t.clock.slept).toEqual([10]);
    });

    it("gives up on a preview that never arrives, saying so", async () => {
      const t = setup();
      ran(t);

      expect(await t.run()).toBe(0);
      expect(t.out).toContain(
        `Preview: none built from ${t.head.slice(0, 7)} yet`
      );
      expect(t.clock.slept).toEqual(Array(29).fill(10));
    });
  });

  describe("a failed check", () => {
    const JOB = "https://github.com/o/r/actions/runs/4/job/42";
    const failed = (t: ReturnType<typeof setup>) => {
      t.github.checkList = [
        { name: "Lint workflows", state: "fail", link: JOB },
        { name: "Build", state: "pending", link: "" },
        { name: "Preview URL", state: "skipping", link: "" },
      ];
      t.clock.onSleep = () => {
        t.github.checkList[1] = { name: "Build", state: "pass", link: "" };
      };
      t.github.main["Lint workflows"] = "success";
    };

    it("waits for every other check, then prints its log from the first error, and fails", async () => {
      const t = setup();
      failed(t);
      t.github.logs["42"] = [
        "2026-11-20T10:00:00.1234567Z \u001b[36;1mnpm run lint\u001b[0m",
        "2026-11-20T10:00:01.1234567Z ##[error]the cause",
        ...Array.from(
          { length: 25 },
          (_, i) => `2026-11-20T10:00:02.0Z line ${i}`
        ),
      ].join("\n");

      expect(await t.run()).toBe(1);
      expect(t.out).toContain("Build\tpass");
      expect(t.out.join("\n")).not.toContain("pending");
      expect(t.err.join("\n")).toBe(
        [
          "Lint workflows failed:",
          "##[error]the cause",
          ...Array.from({ length: 19 }, (_, i) => `line ${i}`),
          "Lint workflows: main's head passes it.",
        ].join("\n")
      );
      expect(t.clock.slept).toEqual([60]);
    });

    it("says when its log has no error line, or can't be read", async () => {
      const t = setup();
      failed(t);
      t.github.checkList.push({
        name: "Unit tests",
        state: "fail",
        link: "https://github.com/o/r/actions/runs/4/job/43",
      });
      t.github.main["Unit tests"] = "success";
      t.github.logs["42"] = "all fine\n";

      expect(await t.run()).toBe(1);
      expect(t.err).toEqual([
        `Lint workflows failed, with no ##[error] line in its log: ${JOB}`,
        "Couldn't read Unit tests's log: https://github.com/o/r/actions/runs/4/job/43",
        "Lint workflows: main's head passes it.",
        "Unit tests: main's head passes it.",
      ]);
    });

    it.each([
      [
        "failure",
        "main's head fails it too, so the cause is likely CI, not this PR.",
      ],
      ["pending", "main's head is still running it."],
      ["none", "main's head hasn't run it."],
      [undefined, "couldn't read main's run of it."],
      ["timed_out", "main's head ended it as timed_out."],
    ])(
      "says whose failure it likely is when main's run is %s",
      async (main, said) => {
        const t = setup();
        failed(t);
        t.github.logs["42"] = "##[error]the cause";
        if (main === undefined) delete t.github.main["Lint workflows"];
        else t.github.main["Lint workflows"] = main;

        expect(await t.run()).toBe(1);
        expect(t.err.at(-1)).toBe(`Lint workflows: ${said}`);
      }
    );
  });

  it("fails on a cancelled check, naming where to rerun it", async () => {
    const t = setup();
    t.github.checkList.push({
      name: "Build",
      state: "cancel",
      link: "https://github.com/o/r/actions/runs/4/job/44",
    });

    expect(await t.run()).toBe(1);
    expect(t.err).toEqual([
      "Build was cancelled. Rerun it from its run: https://github.com/o/r/actions/runs/4/job/44",
    ]);
    expect(t.out).toContain("Build\tcancel");
  });
});
