/**
 * @jest-environment node
 */
import { readdirSync, readFileSync } from "node:fs";

// A job's own `if:` decides whether it runs, but without `!cancelled()` GitHub
// also skips it when any job before it, however far back, was skipped (#171).
// A skipped job passes as a required check, so the failure looks like success:
// a job after the docs-only check would stop running on every push to main.

type Job = { name: string; needs: string[]; condition: string };

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
      return {
        name,
        needs: needs ? needs.split(/,\s*/) : [],
        condition,
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
});

// A secret in a workflow's or a job's `env` reaches every step under it, `npm ci`
// install scripts included (#8), and zizmor doesn't flag it, so this does. See
// CODING_STANDARDS.md, Secrets.
function secretsAboveSteps(text: string): string[] {
  const found: string[] = [];
  let envIndent = -1;
  for (const line of text.split("\n")) {
    const trimmed = line.trimStart();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const indent = line.length - trimmed.length;
    if (envIndent >= 0 && indent <= envIndent) envIndent = -1;
    if (/^(?: {4})?env:/.test(line)) envIndent = indent;
    if (envIndent >= 0 && /\bsecrets\b/.test(line)) found.push(trimmed);
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

describe("the names scripts read", () => {
  // pr-status.sh reads this one; a rename brings back its wait for a preview.
  it("keeps the preview job's name", () => {
    expect(readFileSync(".github/workflows/deploy.yml", "utf8")).toContain(
      "name: Preview URL\n"
    );
  });
});
