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

const script = join(__dirname, "explain-failed-checks.sh");
const link = (job: number) =>
  `https://github.com/o/r/actions/runs/1/job/${job}`;

// A stand-in gh that answers `gh api` from JSON fixtures, filtered by the
// caller's own --jq through the real jq: a check run's annotations by its id,
// and main's check runs by the check_name asked for. A missing fixture fails as
// gh does on a 404.
function fakes() {
  const root = mkdtempSync(join(tmpdir(), "explain-failed-checks-"));
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
    check_name=*) fixture="main-\${1#check_name=}" ;;
    */annotations) id=\${1%/annotations}; fixture="annotations-\${id##*/}" ;;
  esac
  shift
done
file="${fixtures}/$fixture.json"
[[ -f $file ]] || { echo "gh: Not Found (HTTP 404)" >&2; exit 1; }
jq -r "$filter" "$file"
`
  );
  chmodSync(join(bin, "gh"), 0o755);
  const fixture = (name: string, json: unknown) =>
    writeFileSync(join(fixtures, `${name}.json`), JSON.stringify(json));
  const run = (checks: string) =>
    spawnSync("bash", [script], {
      input: checks,
      env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}` },
      encoding: "utf8",
    });
  return { root, fixture, run };
}

const failure = (message: string) => ({ annotation_level: "failure", message });
const mainRun = (
  conclusion: string | null,
  started_at = "2026-11-08T20:00:00Z"
) => ({
  conclusion,
  started_at,
});

describe("explain-failed-checks", () => {
  let f: ReturnType<typeof fakes>;
  beforeEach(() => {
    f = fakes();
  });
  afterEach(() => {
    rmSync(f.root, { recursive: true, force: true });
  });

  // #192's stop: WebKit's missing library, which main failed on too.
  it("prints a failed check's annotations and says main fails it too", () => {
    f.fixture("annotations-42", [
      { annotation_level: "warning", message: "Node.js 20 is deprecated." },
      failure("Process completed with exit code 1."),
      failure(
        "MiniBrowser: error while loading shared libraries: libicudata.so.74"
      ),
    ]);
    f.fixture("main-Playwright, empty feed", {
      check_runs: [mainRun("failure")],
    });

    const result = f.run(
      `Lint workflows\tpass\t8s\t${link(41)}\t\nPlaywright, empty feed\tfail\t2m\t${link(42)}\t\n`
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Playwright, empty feed failed:");
    expect(result.stdout).toContain("libicudata.so.74");
    expect(result.stdout).not.toContain("Node.js 20 is deprecated");
    expect(result.stdout).not.toContain("Process completed");
    expect(result.stdout).toContain(
      "main's head fails it too, so the cause is likely CI, not this PR"
    );
    expect(result.stdout).not.toContain("Lint workflows");
  });

  it("keeps a long annotation to its first lines", () => {
    const lines = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`);
    f.fixture("annotations-42", [failure(lines.join("\n"))]);
    f.fixture("main-Unit tests", { check_runs: [mainRun("success")] });

    const result = f.run(`Unit tests\tfail\t1m\t${link(42)}\t\n`);

    expect(result.stdout).toContain("line 15");
    expect(result.stdout).not.toContain("line 16");
    expect(result.stdout).toContain(link(42));
    expect(result.stdout).toContain("main's head passes it");
  });

  it("reads main's newest run of the check", () => {
    f.fixture("annotations-42", [failure("boom")]);
    f.fixture("main-Unit tests", {
      check_runs: [
        mainRun("failure", "2026-11-08T19:00:00Z"),
        mainRun(null, "2026-11-08T21:00:00Z"),
      ],
    });

    expect(f.run(`Unit tests\tfail\t1m\t${link(42)}\t\n`).stdout).toContain(
      "main's head is still running it"
    );
  });

  it("reports cleanly with no annotations and no run on main", () => {
    f.fixture("main-Unit tests", { check_runs: [] });

    const result = f.run(`Unit tests\tfail\t1m\t${link(42)}\t\n`);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      `no failure annotations; read its log: ${link(42)}`
    );
    expect(result.stdout).toContain("main's head hasn't run it");
  });

  it("says so when GitHub can't say what main did", () => {
    f.fixture("annotations-42", [failure("boom")]);

    const result = f.run(`Unit tests\tfail\t1m\t${link(42)}\t\n`);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Couldn't read main's run of it");
  });
});
