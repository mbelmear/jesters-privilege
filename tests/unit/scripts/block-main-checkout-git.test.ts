/**
 * @jest-environment node
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scriptsDir } from "../../paths";

const script = join(scriptsDir, "block-main-checkout-git.sh");

// Hooks inherit GIT_DIR and GIT_INDEX_FILE (freshen-main-checkout.test.ts).
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (name.startsWith("GIT_")) delete env[name];
}

describe("block-main-checkout-git", () => {
  let root: string;
  let main: string;
  let worktree: string;
  const git = (cwd: string, ...args: string[]) =>
    execFileSync("git", args, { cwd, env, encoding: "utf8" }).trim();

  // The hook reads Claude Code's PreToolUse JSON; exit 2 blocks the call.
  // The tables are built before beforeAll runs, so they name each directory
  // by a token.
  const dirFor = (token: string) =>
    ({ MAIN: main, WORKTREE: worktree, ROOT: root })[token] ?? token;
  const hook = (command: string, cwd: string) =>
    spawnSync("bash", [script], {
      env,
      encoding: "utf8",
      input: JSON.stringify({ cwd: dirFor(cwd), tool_input: { command } }),
    });

  beforeAll(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), "block-main-git-")));
    main = join(root, "main");
    worktree = join(root, "jp-1");
    git(root, "init", "--quiet", "--initial-branch=main", main);
    writeFileSync(join(main, "file"), "first\n");
    git(main, "add", "-A");
    git(
      main,
      "-c",
      "user.email=test@example.com",
      "-c",
      "user.name=Test",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "-m",
      "first"
    );
    git(main, "worktree", "add", "--quiet", "-b", "ticket", worktree);
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  // #278's session checked out origin/main detached in the human's
  // checkout while reading a Dependabot alert; only Edit and Write were guarded.
  it.each([
    [
      "cd into it first",
      (m: string) => `cd ${m} && git checkout -q --detach origin/main`,
      "ROOT",
    ],
    ["run from inside it", () => "git switch ticket-2", "MAIN"],
    [
      "named with -C",
      (m: string) => `git -C ${m} reset --hard origin/main`,
      "ROOT",
    ],
    ["a later command in a chain", () => "git fetch -q; git stash", "MAIN"],
    ["a quoted path", (m: string) => `cd "${m}" && git pull`, "ROOT"],
    ["after a pipe", () => "git status | head; git restore file", "MAIN"],
    ["gh checking out a PR", () => "gh pr checkout 12", "MAIN"],
    // #278's review found each of these passed.
    ["after an assignment", () => "GIT_TRACE=1 git checkout x", "MAIN"],
    ["behind env", () => "env FOO=1 git reset --hard", "MAIN"],
    [
      "behind command or sudo",
      () => "command git switch x; sudo git pull",
      "MAIN",
    ],
    ["by git's full path", () => "/usr/bin/git checkout x", "MAIN"],
    ["in a subshell", (m: string) => `(cd ${m} && git checkout x)`, "ROOT"],
    ["after pushd", (m: string) => `pushd ${m} && git merge x`, "ROOT"],
    [
      "named with --work-tree",
      (m: string) => `git --work-tree ${m} --git-dir ${m}/.git checkout x`,
      "WORKTREE",
    ],
    [
      "named with --git-dir=",
      (m: string) => `git --git-dir=${m}/.git update-ref HEAD x`,
      "WORKTREE",
    ],
    ["a bisect", () => "git bisect start", "MAIN"],
    ["dropping a stash", () => "git stash list && git stash drop", "MAIN"],
    // #278's reviews found these passed, or found them untested.
    [
      "behind env -u or command -p",
      () => "env -u FOO git checkout x; command -p git pull",
      "MAIN",
    ],
    [
      "after builtin cd",
      (m: string) => `builtin cd ${m} && git checkout x`,
      "ROOT",
    ],
    ["inside $(…)", (m: string) => `echo $(git -C ${m} checkout x)`, "ROOT"],
    ["behind exec -a", () => "exec -a name git checkout x", "MAIN"],
    // A quoted ) once ended the cd before it (#278's third review).
    [
      "after a quoted )",
      (m: string) => `pushd ${m}; echo ")"; git checkout x`,
      "WORKTREE",
    ],
    // Refused on purpose: a cd lasts to the end of the command, so a quoted )
    // can't end it (the hook's header).
    [
      "in a subshell, then in a worktree",
      (m: string) => `(cd ${m} && git status) && git commit -m x`,
      "WORKTREE",
    ],
    [
      "after pushd and popd",
      (m: string) => `pushd ${m}; popd; git checkout -b y`,
      "WORKTREE",
    ],
    // #278's second review found these passed.
    [
      "behind a wrapper's options",
      () => "env -i git checkout x; sudo -u root git pull",
      "MAIN",
    ],
    [
      "behind time -p or nice",
      () => "time -p git reset; nice -n 5 git merge x",
      "MAIN",
    ],
    ["after cd --", (m: string) => `cd -- ${m} && git checkout x`, "ROOT"],
    [
      "inside an if",
      (m: string) => `if cd ${m}; then git checkout x; fi`,
      "ROOT",
    ],
    [
      "a --git-dir relative to -C",
      (m: string) => `git -C ${m} --git-dir=.git checkout x`,
      "ROOT",
    ],
  ])(
    "refuses a command that changes the main checkout: %s",
    (_, command, cwd) => {
      const result = hook(command(main), cwd);

      expect(result.status).toBe(2);
      expect(result.stderr).toContain("the main checkout belongs to the human");
      expect(result.stderr).toContain("npm run worktree");
    }
  );

  it.each([
    [
      "reads in the main checkout",
      () => "git status && git log --oneline -3 && git diff",
      "MAIN",
    ],
    [
      "fetch and show from origin/main",
      () => "git fetch -q && git show origin/main:file",
      "MAIN",
    ],
    ["list worktrees", () => "git worktree list", "MAIN"],
    [
      "list and show stashes",
      () => "git stash list; git stash show -p",
      "MAIN",
    ],
    ["make a worktree", () => "npm run worktree -- 5 branch", "MAIN"],
    // A line of a PR body read as a command once (#278's third review).
    [
      "a Markdown bullet naming git",
      () => "gh pr create --body '\n- git add the new hook'",
      "MAIN",
    ],
    ["commit in a worktree", () => "git add -A && git commit -m x", "WORKTREE"],
    [
      "cd into a worktree to check out",
      (_m: string, w: string) => `cd ${w} && git checkout -b other`,
      "MAIN",
    ],
    ["anything outside a repository", () => "git checkout x", "ROOT"],
    ["no git at all", () => "ls && echo checkout", "MAIN"],
  ])("allows %s", (_, command, cwd) => {
    const result = hook(command(main, worktree), cwd);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });
});
