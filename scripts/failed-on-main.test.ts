/**
 * @jest-environment node
 */
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const script = join(__dirname, "failed-on-main.sh");

// Rows as gh pr checks prints them: name, state, time, link.
const row = (name: string, state: string) =>
  `${name}\t${state}\t1m\thttps://github.com/o/r/actions/runs/4/job/42\t`;

// A stand-in gh that answers main's check runs from a JSON fixture named after
// the check_name asked for, filtered by the caller's own --jq through the real
// jq. A missing fixture fails as gh does on a 404.
function fakes() {
  const root = mkdtempSync(join(tmpdir(), "failed-on-main-"));
  const bin = join(root, "bin");
  const fixtures = join(root, "fixtures");
  mkdirSync(bin);
  mkdirSync(fixtures);
  writeFileSync(
    join(bin, "gh"),
    `#!/bin/bash
fixture="" filter="."
while (($#)); do
  case $1 in
    --jq) filter=$2; shift ;;
    check_name=*) fixture=\${1#check_name=} ;;
  esac
  shift
done
file="${fixtures}/$fixture.json"
[[ -f $file ]] || { echo "gh: Not Found (HTTP 404)" >&2; exit 1; }
jq -r "$filter" "$file"
`
  );
  chmodSync(join(bin, "gh"), 0o755);
  const onMain = (check: string, ...runs: [string | null, string][]) =>
    writeFileSync(
      join(fixtures, `${check}.json`),
      JSON.stringify({
        check_runs: runs.map(([conclusion, started_at]) => ({
          conclusion,
          started_at,
        })),
      })
    );
  const run = (checks: string) =>
    spawnSync("bash", [script], {
      input: checks,
      env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}` },
      encoding: "utf8",
    });
  return { root, onMain, run };
}

const AT = "2026-11-08T20:00:00Z";

describe("failed-on-main", () => {
  let f: ReturnType<typeof fakes>;
  beforeEach(() => {
    f = fakes();
  });
  afterEach(() => {
    rmSync(f.root, { recursive: true, force: true });
  });

  // #192's stop: WebKit's missing library, which main failed on too.
  it("says main fails a failed check too, so CI is the likely cause", () => {
    f.onMain("Playwright, empty feed", ["failure", AT]);

    const result = f.run(
      `${row("Lint workflows", "pass")}\n${row("Playwright, empty feed", "fail")}\n`
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      "Playwright, empty feed: main's head fails it too, so the cause is likely CI, not this PR.\n"
    );
  });

  it("says main passes it", () => {
    f.onMain("Unit tests", ["success", AT]);

    expect(f.run(`${row("Unit tests", "fail")}\n`).stdout).toBe(
      "Unit tests: main's head passes it.\n"
    );
  });

  it("reads main's newest run of the check", () => {
    f.onMain(
      "Unit tests",
      ["failure", "2026-11-08T19:00:00Z"],
      [null, "2026-11-08T21:00:00Z"]
    );

    expect(f.run(`${row("Unit tests", "fail")}\n`).stdout).toBe(
      "Unit tests: main's head is still running it.\n"
    );
  });

  it("says when main hasn't run it", () => {
    f.onMain("Unit tests");

    expect(f.run(`${row("Unit tests", "fail")}\n`).stdout).toBe(
      "Unit tests: main's head hasn't run it.\n"
    );
  });

  it("says when GitHub can't say what main did", () => {
    const result = f.run(`${row("Unit tests", "fail")}\n`);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("Unit tests: couldn't read main's run of it.\n");
  });

  // gh pr checks leaves elapsed blank for a check that never started.
  it("reads a row with a blank column", () => {
    f.onMain("Unit tests", ["success", AT]);

    expect(f.run("Unit tests\tfail\t\t\t\n").stdout).toBe(
      "Unit tests: main's head passes it.\n"
    );
  });

  it("asks nothing when nothing failed", () => {
    expect(f.run(`${row("Unit tests", "pass")}\n`).stdout).toBe("");
  });
});
