/**
 * @jest-environment node
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const script = join(__dirname, "merge-on-green.sh");

// Run by a stand-in, in the clone, while the script waits.
const CONFLICTING_PUSH = `printf 'top\\nmiddle\\nmain line\\n' > deploy.md
git add -A
git commit --quiet -m Conflicting
git push --quiet origin main
`;

// Git run from a hook inherits GIT_DIR and GIT_INDEX_FILE, which point every
// git command at the real repository (merge-holds-branch.test.ts tells that
// story), so every git here drops them.
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (name.startsWith("GIT_")) delete env[name];
}

// A clone of a throwaway origin, and stand-ins on the PATH. GitHub reports the
// PR's head as reviewed and its checks as passed, unless the test's `rollup` or
// `checksExit` say otherwise, and a merge prints a line rather than happening.
// sleep only counts, then runs what the test put in `onSleep`: what happens
// during the wait. gh pr checks runs `onChecks` the same way, and gh pr merge
// `onMerge`. GitHub's head is read from `headFile`.
function repo() {
  const root = mkdtempSync(join(tmpdir(), "merge-on-green-"));
  const origin = join(root, "origin.git");
  const dir = join(root, "clone");
  const bin = join(root, "bin");
  const rollup = join(root, "rollup");
  const checksExit = join(root, "checks-exit");
  const onSleep = join(root, "on-sleep");
  const onChecks = join(root, "on-checks");
  const onMerge = join(root, "on-merge");
  const headFile = join(root, "head");
  const failedRow = join(root, "failed-row");
  const sleeps = join(root, "sleeps");
  execFileSync(
    "git",
    ["init", "--quiet", "--bare", "--initial-branch=main", origin],
    { env }
  );
  execFileSync("git", ["clone", "--quiet", origin, dir], {
    env,
    stdio: "ignore",
  });
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: dir, env, encoding: "utf8" }).trim();
  // Refuse to go on anywhere but the throwaway repo.
  if (!git("rev-parse", "--absolute-git-dir").startsWith(realpathSync(dir))) {
    throw new Error(`git isn't working in ${dir}`);
  }
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  git("config", "commit.gpgsign", "false");
  const commit = (lines: string[], message: string) => {
    writeFileSync(join(dir, "deploy.md"), lines.join("\n") + "\n");
    git("add", "-A");
    git("commit", "--quiet", "-m", message);
    return git("rev-parse", "HEAD");
  };
  const fakeGh = (head: string) => {
    mkdirSync(bin, { recursive: true });
    writeFileSync(rollup, "3\n");
    writeFileSync(checksExit, "0\n");
    writeFileSync(onSleep, "");
    writeFileSync(onChecks, "");
    writeFileSync(onMerge, "");
    writeFileSync(failedRow, "");
    writeFileSync(headFile, `${head}\n`);
    writeFileSync(sleeps, "");
    writeFileSync(
      join(bin, "gh"),
      `#!/bin/sh
case "$*" in
  *headRefOid*) cat "${headFile}" ;;
  *statusCheckRollup*) cat "${rollup}" ;;
  *comments*) echo "Code review: passed at ${head}" ;;
  "pr checks"*) . "${onChecks}"; echo "Build static site	pass"; [ -s "${failedRow}" ] && cat "${failedRow}"; exit "$(cat "${checksExit}")" ;;
  "api "*) echo "##[error] the cause" ;;
  "pr merge"*) . "${onMerge}"; echo MERGED ;;
esac
`
    );
    chmodSync(join(bin, "gh"), 0o755);
    writeFileSync(
      join(bin, "sleep"),
      `#!/bin/sh\necho slept >> "${sleeps}"\n. "${onSleep}"\n`
    );
    chmodSync(join(bin, "sleep"), 0o755);
  };
  const merge = (...args: string[]) =>
    spawnSync("bash", [script, "7", ...args], {
      cwd: dir,
      env: { ...env, PATH: `${bin}${delimiter}${env.PATH}` },
      encoding: "utf8",
      timeout: 30_000,
    });
  const sleepCount = () =>
    readFileSync(sleeps, "utf8").split("\n").filter(Boolean).length;
  return {
    root,
    dir,
    rollup,
    checksExit,
    onSleep,
    onChecks,
    onMerge,
    headFile,
    failedRow,
    git,
    commit,
    fakeGh,
    merge,
    sleepCount,
  };
}

describe("merge-on-green", () => {
  let r: ReturnType<typeof repo>;
  beforeEach(() => {
    r = repo();
    r.commit(["top", "middle", "bottom"], "start");
    r.git("push", "--quiet", "origin", "main");
    r.git("checkout", "--quiet", "-b", "ticket");
    const head = r.commit(["top", "middle", "the PR's line"], "the PR");
    r.git("push", "--quiet", "origin", "ticket");
    r.fakeGh(head);
    r.git("checkout", "--quiet", "main");
  });
  afterEach(() => {
    rmSync(r.root, { recursive: true, force: true });
  });

  // What main gains while the PR's checks run: the PR's file, away from its line.
  function mainGains(message: string) {
    const sha = r.commit([message, "middle", "bottom"], message);
    r.git("push", "--quiet", "origin", "main");
    return sha;
  }

  // What main gains on the PR's own line.
  function mainConflicts() {
    r.commit(["top", "middle", "main's line"], "Conflicting");
    r.git("push", "--quiet", "origin", "main");
  }

  it("merges when main has gained nothing in the PR's files", () => {
    const result = r.merge();

    expect(result.stdout).toContain("MERGED");
    expect(result.status).toBe(0);
  });

  it("refuses, naming the commit, when main has gained one in the PR's files", () => {
    const other = mainGains("Smoke check");

    const result = r.merge();

    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("MERGED");
    expect(result.stderr).toContain(`${other} Smoke check`);
    expect(result.stderr).toContain(`--overlap-read ${other}`);
    expect(result.stderr).toMatch(
      /scripts\/main-overlap\.sh --patch \w+ origin\/main/
    );
  });

  it("merges once the newest such commit is passed as read", () => {
    const other = mainGains("Smoke check");

    const result = r.merge("--overlap-read", other);

    expect(result.stdout).toContain("MERGED");
    expect(result.status).toBe(0);
  });

  it("refuses when a newer commit has landed since the one read", () => {
    const read = mainGains("Smoke check");
    const newer = mainGains("Another");

    const result = r.merge("--overlap-read", read);

    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("MERGED");
    expect(result.stderr).toContain(`--overlap-read ${newer}`);
  });

  it("sees what main gained elsewhere, not just this clone's last fetch", () => {
    const before = r.git("rev-parse", "origin/main");
    const other = mainGains("Smoke check");
    r.git("update-ref", "refs/remotes/origin/main", before);

    const result = r.merge();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`${other} Smoke check`);
  });

  it("refuses when the PR conflicts with main, without offering --overlap-read", () => {
    mainConflicts();

    const result = r.merge();

    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("MERGED");
    expect(result.stderr).toContain("conflicts with main");
    expect(result.stderr).toContain("Merge origin/main in");
    expect(result.stderr).not.toContain("--overlap-read");
  });

  it("stops waiting as soon as main comes to conflict, with checks still pending", () => {
    writeFileSync(r.checksExit, "8\n");
    writeFileSync(r.onSleep, CONFLICTING_PUSH);

    const result = r.merge();

    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("MERGED");
    expect(result.stderr).toContain("conflicts with main");
    expect(r.sleepCount()).toBe(1);
  });

  it("names the conflict when a conflicting push never gets checks", () => {
    writeFileSync(r.rollup, "0\n");
    mainConflicts();

    const result = r.merge();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("conflicts with main");
    expect(result.stderr).not.toContain("no checks reported");
    expect(r.sleepCount()).toBe(0);
  });

  it("names the conflict when main comes to conflict as the last check passes", () => {
    writeFileSync(r.onChecks, CONFLICTING_PUSH);

    const result = r.merge();

    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("MERGED");
    expect(result.stderr).toContain("conflicts with main");
    expect(result.stderr).not.toContain("--overlap-read");
  });

  it("doesn't call it a conflict when the PR's head can't be fetched", () => {
    r.fakeGh("0".repeat(40));

    const result = r.merge();

    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain("MERGED");
    expect(result.stderr).not.toContain("conflicts with main");
  });

  it("waits for pending checks, then merges", () => {
    writeFileSync(r.checksExit, "8\n");
    writeFileSync(r.onSleep, `echo 0 > "${r.checksExit}"\n`);

    const result = r.merge();

    expect(result.stdout).toContain("MERGED");
    expect(result.status).toBe(0);
    expect(r.sleepCount()).toBe(1);
  });

  it("refuses, showing the checks, when one fails", () => {
    writeFileSync(r.checksExit, "1\n");

    const result = r.merge();

    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("MERGED");
    expect(result.stdout).toContain("Build static site");
  });

  it("refuses, printing the failed job's errors", () => {
    writeFileSync(r.checksExit, "1\n");
    writeFileSync(
      r.failedRow,
      "Lint workflows\tfail\t8s\thttps://github.com/o/r/actions/runs/4/job/42\n"
    );

    const result = r.merge();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Lint workflows failed:\n##[error] the cause"
    );
  });

  // What gh printed when GitHub refused #193's merge with its head unchanged.
  const MODIFIED =
    "GraphQL: Head branch was modified. Review and try the merge again. (mergePullRequest)";

  it("tries the merge once more when GitHub calls an unchanged head modified", () => {
    writeFileSync(
      r.onMerge,
      `[ -e "${r.root}/refused" ] || { touch "${r.root}/refused"; echo "${MODIFIED}" >&2; exit 1; }\n`
    );

    const result = r.merge();

    expect(result.stdout).toContain("MERGED");
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("trying the merge once more");
  });

  it("stops when GitHub refuses the merge a second time", () => {
    writeFileSync(
      r.onMerge,
      `echo merge >> "${r.root}/merges"; echo "${MODIFIED}" >&2; exit 1\n`
    );

    const result = r.merge();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(MODIFIED);
    expect(readFileSync(join(r.root, "merges"), "utf8")).toBe("merge\nmerge\n");
  });

  it("stops without retrying when the head really was pushed to", () => {
    writeFileSync(
      r.onMerge,
      `echo merge >> "${r.root}/merges"; echo ${"b".repeat(40)} > "${r.headFile}"; echo "${MODIFIED}" >&2; exit 1\n`
    );

    const result = r.merge();

    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("MERGED");
    expect(readFileSync(join(r.root, "merges"), "utf8")).toBe("merge\n");
  });

  it("waits through a network drop while checks run, then merges", () => {
    writeFileSync(
      r.onChecks,
      `[ -e "${r.root}/dropped" ] || { touch "${r.root}/dropped"; echo "error connecting to api.github.com" >&2; exit 1; }\n`
    );

    const result = r.merge();

    expect(result.stdout).toContain("MERGED");
    expect(result.status).toBe(0);
  });

  it("waits through a network drop before checks appear, then merges", () => {
    rmSync(r.rollup);
    writeFileSync(r.onSleep, `echo 3 > "${r.rollup}"\n`);

    const result = r.merge();

    expect(result.stdout).toContain("MERGED");
    expect(result.status).toBe(0);
  });

  it("waits for checks to appear after a push", () => {
    writeFileSync(r.rollup, "0\n");
    writeFileSync(r.onSleep, `echo 3 > "${r.rollup}"\n`);

    const result = r.merge();

    expect(result.stdout).toContain("MERGED");
    expect(result.status).toBe(0);
    expect(r.sleepCount()).toBe(1);
  });

  it("refuses when checks never appear", () => {
    writeFileSync(r.rollup, "0\n");

    const result = r.merge();

    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("MERGED");
    expect(result.stderr).toContain("no checks reported");
    expect(r.sleepCount()).toBe(30);
  });

  it.each([[["--overlap-read"]], [["--overlap", "abc"]]])(
    "refuses a malformed call: %j",
    (args) => {
      const result = r.merge(...args);

      expect(result.status).toBe(2);
      expect(result.stdout).not.toContain("MERGED");
    }
  );
});
