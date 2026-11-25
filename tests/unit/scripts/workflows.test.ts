/**
 * @jest-environment node
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A job's own `if:` decides whether it runs, but without `!cancelled()` GitHub
// also skips it when any job before it, however far back, was skipped (#171).
// A skipped job passes as a required check, so the failure looks like success:
// a job after the docs-only check would stop running on every push to main.

type Job = {
  name: string;
  needs: string[];
  condition: string;
  timeout?: number;
};

function jobsIn(text: string): Job[] {
  const [, jobs = ""] = text.split(/^jobs:\n/m);
  for (const line of jobs.split("\n")) {
    const unreadable =
      (/^ {2}[^\s#]/.test(line) && !/^ {2}[\w-]+:$/.test(line)) ||
      (/^ {4}needs:/.test(line) &&
        !/^ {4}needs: (?:[\w-]+|\[[\w-]+(?:, *[\w-]+)*\])$/.test(line));
    if (unreadable) throw new Error(`workflows.test.ts can't read: ${line}`);
  }
  return jobs
    .split(/^(?= {2}[\w-]+:\n)/m)
    .map((block) => {
      const name = /^ {2}([\w-]+):\n/.exec(block)?.[1] ?? "";
      const needs = /^ {4}needs: \[?([^\]\n]+)\]?$/m.exec(block)?.[1] ?? "";
      // An `if:` runs on over its indented lines, to the job's next key.
      const condition = /^ {4}if: (.*(?:\n {6,}.*)*)/m.exec(block)?.[1] ?? "";
      const timeout = /^ {4}timeout-minutes: (\d+)$/m.exec(block)?.[1];
      return {
        name,
        needs: needs ? needs.split(/,\s*/) : [],
        condition,
        timeout: timeout ? Number(timeout) : undefined,
      };
    })
    .filter((job) => job.name);
}

function afterDocsOnly(jobs: Job[]): Job[] {
  const after = new Set(["docs-only"]);
  for (let grew = true; grew;) {
    grew = false;
    for (const job of jobs) {
      if (!after.has(job.name) && job.needs.some((n) => after.has(n))) {
        after.add(job.name);
        grew = true;
      }
    }
  }
  return jobs.filter((job) => job.name !== "docs-only" && after.has(job.name));
}

describe.each(["ci.yml", "deploy.yml"])(
  "%s after the docs-only check",
  (file) => {
    const jobs = afterDocsOnly(
      jobsIn(readFileSync(`.github/workflows/${file}`, "utf8"))
    );

    it("finds the jobs it holds to the rule", () => {
      expect(jobs.length).toBeGreaterThan(0);
    });

    it("runs each job despite a skipped ancestor", () => {
      const unguarded = jobs
        .filter((job) => !job.condition.includes("!cancelled()"))
        .map((job) => job.name);
      expect(unguarded).toEqual([]);
    });

    it("stops each job when the job it needs fails", () => {
      const unchecked = jobs
        .filter((job) =>
          job.needs.some(
            (need) =>
              need !== "docs-only" &&
              !job.condition.includes(`needs.${need}.result == 'success'`)
          )
        )
        .map((job) => job.name);
      expect(unchecked).toEqual([]);
    });
  }
);

describe("reading a workflow", () => {
  // Skipping a job it can't read would pass that job without checking it.
  it.each([
    ["a job line with a comment", "  build: # note\n    runs-on: x\n"],
    ["needs with a comment", "  build:\n    needs: docs-only # note\n"],
    ["needs as a block list", "  build:\n    needs:\n      - docs-only\n"],
  ])("refuses %s", (_, jobs) => {
    expect(() => jobsIn(`jobs:\n${jobs}`)).toThrow(/can't read/);
  });

  it("reads one need, several, and an if: over several lines", () => {
    const text = `jobs:
  first:
    runs-on: x
  second:
    needs: first
    if: >-
      !cancelled() &&
      always()
    runs-on: x
  third:
    needs: [first, second]
`;
    expect(jobsIn(text)).toEqual([
      { name: "first", needs: [], condition: "" },
      {
        name: "second",
        needs: ["first"],
        condition: ">-\n      !cancelled() &&\n      always()",
      },
      { name: "third", needs: ["first", "second"], condition: "" },
    ]);
  });

  it("reads a job's time limit", () => {
    expect(
      jobsIn("jobs:\n  first:\n    runs-on: x\n    timeout-minutes: 15\n")
    ).toEqual([{ name: "first", needs: [], condition: "", timeout: 15 }]);
  });
});

// A secret or the GitHub token in a workflow's or a job's `env` reaches every
// step under it, `npm ci` install scripts included (#8), and zizmor doesn't flag
// it, so this does. See CODING_STANDARDS.md, Secrets.
function secretsAboveSteps(text: string): string[] {
  const found: string[] = [];
  let envIndent = -1;
  for (const line of text.split("\n")) {
    const trimmed = line.trimStart();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const indent = line.length - trimmed.length;
    if (envIndent >= 0 && indent <= envIndent) envIndent = -1;
    if (/^(?: {4})?env:/.test(line)) envIndent = indent;
    if (envIndent >= 0 && /\bsecrets\b|\bgithub\.token\b/.test(line))
      found.push(trimmed);
  }
  return found;
}

describe("a workflow's secrets", () => {
  it.each(readdirSync(".github/workflows"))(
    "%s hands them only to steps",
    (file) => {
      expect(
        secretsAboveSteps(readFileSync(`.github/workflows/${file}`, "utf8"))
      ).toEqual([]);
    }
  );

  it("refuses one in the workflow's env", () => {
    const text = [
      "env:",
      "  KEY: ${{ secrets.KEY }}",
      "jobs:",
      "  deploy:",
      "    steps:",
      "      - run: npm ci",
    ].join("\n");

    expect(secretsAboveSteps(text)).toEqual(["KEY: ${{ secrets.KEY }}"]);
  });

  it("refuses one in a job's env", () => {
    const text = [
      "jobs:",
      "  deploy:",
      "    env:",
      "      KEY: ${{ secrets.KEY }}",
      "    steps:",
      "      - run: npm ci",
    ].join("\n");

    expect(secretsAboveSteps(text)).toEqual(["KEY: ${{ secrets.KEY }}"]);
  });

  it("refuses the GitHub token in a job's env", () => {
    const text = [
      "jobs:",
      "  deploy:",
      "    env:",
      "      GH_TOKEN: ${{ github.token }}",
      "    steps:",
      "      - run: npm ci",
    ].join("\n");

    expect(secretsAboveSteps(text)).toEqual(["GH_TOKEN: ${{ github.token }}"]);
  });

  it("passes one in a step's env, and a job's env without one", () => {
    const text = [
      "jobs:",
      "  deploy:",
      "    env:",
      "      FEED: live",
      "    steps:",
      "      - run: wrangler deploy",
      "        env:",
      "          KEY: ${{ secrets.KEY }}",
    ].join("\n");

    expect(secretsAboveSteps(text)).toEqual([]);
  });
});

// ubuntu-latest moved to ubuntu-26.04 on 2026-11-08 without a commit here, and
// WebKit stopped launching (#196). A runner image changes only in a PR.
// A pull_request_target run holds a write token even for a fork's PR, so only
// the one workflow CODING_STANDARDS.md (Secrets) names may use it: pr-gate.yml,
// which runs main's copy of itself and never the PR's code.
describe("pull_request_target", () => {
  it("starts only the PR gate", () => {
    const using = readdirSync(".github/workflows").filter((file) =>
      readFileSync(`.github/workflows/${file}`, "utf8").includes(
        "pull_request_target"
      )
    );

    expect(using).toEqual(["pr-gate.yml"]);
  });
});

describe("a workflow's runners", () => {
  it.each(readdirSync(".github/workflows"))("%s names its image", (file) => {
    const runners = readFileSync(`.github/workflows/${file}`, "utf8").match(
      /^ +runs-on: .*$/gm
    );

    expect(runners?.map((line) => line.trim())).toEqual(
      runners?.map(() => "runs-on: ubuntu-24.04")
    );
  });

  // A job left to GitHub's default runs up to 6 hours. From 4 to 7 November a
  // slow apt mirror held Playwright's system-package install 35-60 minutes (#158); once the
  // repo is private (#145), every one of those minutes is billed.
  it.each(readdirSync(".github/workflows"))(
    "%s gives each job a time limit",
    (file) => {
      const jobs = jobsIn(readFileSync(`.github/workflows/${file}`, "utf8"));

      expect(jobs.length).toBeGreaterThan(0);
      expect(
        jobs.filter((job) => job.timeout === undefined).map((job) => job.name)
      ).toEqual([]);
    }
  );
});

describe("the names scripts read", () => {
  // The PR gate reads this one (src/lib/pr-gate/snapshot.ts); a rename brings back its wait for a preview.
  it("keeps the preview job's name", () => {
    expect(readFileSync(".github/workflows/deploy.yml", "utf8")).toContain(
      "name: Preview URL\n"
    );
  });
});

// Transcribe's plan transcribes an Episode older than a week only when the run
// was started by hand (#240); without this line every run is scheduled.
describe("Transcribe", () => {
  it("tells the plan whether the run was started by hand", () => {
    expect(readFileSync(".github/workflows/transcribe.yml", "utf8")).toMatch(
      /^ {6}TRANSCRIBE_ANY_AGE: \$\{\{ github\.event_name == 'workflow_dispatch' \}\}$/m
    );
  });
});

// A saved Transcript publishes when Transcribe starts Deploy itself, not at the
// next feed check, which GitHub may run hours late (#298). Only a run that
// pushed one starts it.
describe("Transcribe's push", () => {
  const text = readFileSync(".github/workflows/transcribe.yml", "utf8");
  const script = (
    /^ {6}- name: Push to the transcripts branch\n(?: {8}.*\n)*? {8}run: \|\n((?: {10}.*\n|\n)+)/m.exec(
      text
    )?.[1] ?? ""
  ).replace(/^ {10}/gm, "");

  // Runs the step with git answering `diff --cached --quiet` with the given
  // exit code (1: something is staged), and returns what it wrote to
  // $GITHUB_OUTPUT.
  const run = (diffCode: number) => {
    const dir = mkdtempSync(join(tmpdir(), "transcribe-push-"));
    const output = join(dir, "output");
    writeFileSync(output, "");
    const result = spawnSync(
      "bash",
      [
        "-e",
        "-c",
        `git() { echo "git $*"; if [ "$1" = diff ]; then return ${diffCode}; fi; }
${script}`,
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          TRANSCRIPTS_DIR: dir,
          GITHUB_OUTPUT: output,
          GITHUB_RUN_ID: "1",
        },
      }
    );
    return { result, output: readFileSync(output, "utf8") };
  };

  it("says it pushed after pushing a Transcript", () => {
    const { result, output } = run(1);
    expect(result.stdout).toContain("git push origin transcripts");
    expect(result.status).toBe(0);
    expect(output).toBe("pushed=true\n");
  });

  it("says nothing when there was nothing to push", () => {
    const { result, output } = run(0);
    expect(result.stdout).not.toContain("git push");
    expect(result.status).toBe(0);
    expect(output).toBe("");
  });

  // The step that starts Deploy, from its `- name:` to the next step.
  const dispatch =
    text
      .split(/^(?= {6}- )/m)
      .find((step) => step.includes("gh workflow run deploy.yml")) ?? "";

  it("starts a production Deploy", () => {
    expect(dispatch).toMatch(/^ {10}gh workflow run deploy\.yml --ref main$/m);
  });

  it("starts it only after a push, and never from a pull request", () => {
    const condition = /^ {8}if: (?:>-\n)?((?: {10}.*\n)+|.*\n)/m
      .exec(dispatch)?.[1]
      ?.replace(/\s+/g, " ")
      .trim();
    expect(condition).toBe(
      "github.event_name != 'pull_request' && steps.push.outputs.pushed == 'true'"
    );
  });
});

// Nightly's report opens an issue only for a job it needs; one left out fails
// in the Actions tab, where nobody looks (#178).
describe("Nightly's failure report", () => {
  it("needs every job that runs on schedule", () => {
    const jobs = jobsIn(readFileSync(".github/workflows/nightly.yml", "utf8"));
    const report = jobs.find((job) => job.name === "report");
    const scheduled = jobs.filter(
      (job) =>
        job.name !== "report" &&
        job.condition !== "github.event_name == 'pull_request'"
    );

    expect([...(report?.needs ?? [])].sort()).toEqual(
      scheduled.map((job) => job.name).sort()
    );
  });
});

// #276's gate went red on one dropped `gh pr view` and needed a manual rerun.
describe("pr-gate.yml's check step", () => {
  const text = readFileSync(".github/workflows/pr-gate.yml", "utf8");
  // The `run: |` block that runs the check, wherever it sits in the job.
  const block =
    [...text.matchAll(/^ {6}- run: \|\n((?: {10}.*\n)+)/gm)]
      .map((match) => match[1] ?? "")
      .find((body) => body.includes("pr-gate-check.ts")) ?? "";
  const script = block.replace(/^ {10}/gm, "");

  // Runs the step with npx answering each call with the next exit code.
  const run = (codes: number[]) =>
    spawnSync(
      "bash",
      [
        "-e",
        "-c",
        `codes=(${codes.join(" ")}); calls=0
npx() { echo "call $calls"; local code=\${codes[$calls]}; calls=$((calls + 1)); return "$code"; }
sleep() { :; }
${script}`,
      ],
      { encoding: "utf8", env: { ...process.env, PR: "1" } }
    );

  it("names the check it runs", () => {
    expect(script).toContain('npx tsx scripts/pr-gate-check.ts "$PR"');
  });

  it("tries once more when a read failed, and passes if that one does", () => {
    const result = run([1, 0]);
    expect(result.stdout).toContain("call 1");
    expect(result.stdout).toContain("::warning::The PR gate check failed");
    expect(result.status).toBe(0);
  });

  it("fails when the second try's read fails too", () => {
    expect(run([1, 1]).status).toBe(1);
  });

  it.each([0, 2])("runs the check once when it exits %i", (code) => {
    const result = run([code]);
    expect(result.stdout).not.toContain("call 1");
    expect(result.status).toBe(code);
  });
});
