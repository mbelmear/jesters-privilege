/**
 * @jest-environment node
 */
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scriptsDir } from "../../paths";

const script = join(scriptsDir, "report-nightly.ts");

// The newest failed Nightly only shows the advice its own failed jobs earn,
// so a pull request adding advice for another job (#224) previews it by name.
describe("report-nightly --dry-run --failed-job", () => {
  let bin: string;
  beforeEach(() => {
    // A gh that fails, so the preview is shown to need no run, token or network.
    bin = mkdtempSync(join(tmpdir(), "report-nightly-"));
    writeFileSync(join(bin, "gh"), "#!/bin/sh\necho gh called >&2\nexit 1\n");
    chmodSync(join(bin, "gh"), 0o755);
  });
  afterEach(() => {
    rmSync(bin, { recursive: true, force: true });
  });

  const run = (...args: string[]) =>
    spawnSync("npx", ["tsx", script, ...args], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}` },
    });

  it("prints the report for the jobs it names, without asking GitHub", () => {
    const result = run(
      "--dry-run",
      "--failed-job",
      "zizmor (online)",
      "--failed-job",
      "Email Routing"
    );

    expect(result.stderr).not.toContain("gh called");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "- zizmor (online) flagged a workflow or action under .github."
    );
    expect(result.stdout).toContain(
      "No test is named in the failed jobs' logs (Email Routing)"
    );
  });

  it("asks GitHub for the newest failure without --failed-job", () => {
    expect(run("--dry-run").stderr).toContain("gh called");
  });

  it("refuses --failed-job without a job's name", () => {
    const result = run("--dry-run", "--failed-job");

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("--failed-job");
  });

  it("refuses --failed-job beside a run id, which would file a real report", () => {
    const result = run("123", "--failed-job", "zizmor (online)");

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("--failed-job");
  });
});
