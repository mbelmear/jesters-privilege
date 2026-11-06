/**
 * @jest-environment node
 */
import { readFileSync } from "node:fs";

// A job's own `if:` decides whether it runs, but without `!cancelled()` GitHub
// also skips it when any job before it, however far back, was skipped (#171).
// A skipped job passes as a required check, so the failure looks like success:
// a job after the docs-only check would stop running on every push to main.

type Job = { name: string; needs: string[]; condition: string };

function jobsIn(workflow: string): Job[] {
  const text = readFileSync(`.github/workflows/${workflow}`, "utf8");
  const [, jobs = ""] = text.split(/^jobs:\n/m);
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
    const jobs = afterDocsOnly(jobsIn(file));

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

describe("the names scripts read", () => {
  // pr-status.sh reads this one; a rename brings back its wait for a preview.
  it("keeps the preview job's name", () => {
    expect(readFileSync(".github/workflows/deploy.yml", "utf8")).toContain(
      "name: Preview URL\n"
    );
  });
});
