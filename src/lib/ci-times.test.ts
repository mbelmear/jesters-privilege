import { formatCiTimes, readRun, summariseRun, type Run } from "./ci-times";

const step = (name: string, startedAt: string, completedAt: string) => ({
  name,
  startedAt,
  completedAt,
});

const run: Run = {
  databaseId: 42,
  headBranch: "some-branch",
  event: "pull_request",
  conclusion: "success",
  createdAt: "2026-11-11T22:00:00Z",
  attempt: 1,
  jobs: [
    {
      name: "Build static site",
      conclusion: "success",
      startedAt: "2026-11-11T22:00:30Z",
      completedAt: "2026-11-11T22:20:30Z",
      steps: [
        step(
          "Run ./.github/actions/setup",
          "2026-11-11T22:00:30Z",
          "2026-11-11T22:01:30Z"
        ),
        step(
          "Run npm run build",
          "2026-11-11T22:01:30Z",
          "2026-11-11T22:20:10Z"
        ),
        step("Post Run", "2026-11-11T22:20:10Z", "2026-11-11T22:20:30Z"),
      ],
    },
    {
      name: "Playwright (Chromium, WebKit)",
      conclusion: "success",
      startedAt: "2026-11-11T22:21:00Z",
      completedAt: "2026-11-11T22:33:00Z",
      steps: [
        // `gh run view` prints the year 1 for a time that hasn't happened, as
        // run 43127413358 did for a job still running (12 November 2026).
        step("Upload report", "0001-01-01T00:00:00Z", "0001-01-01T00:00:00Z"),
      ],
    },
    {
      name: "Docs-only check",
      conclusion: "skipped",
      startedAt: "2026-11-11T22:00:05Z",
      completedAt: "2026-11-11T22:00:05Z",
      steps: [],
    },
  ],
};

describe("summariseRun", () => {
  it("times the run from creation to its last job, and its wait for a runner", () => {
    const summary = summariseRun(run, 60);

    expect(summary.minutes).toBe(33);
    expect(summary.queuedSeconds).toBe(30);
  });

  it("leaves out skipped jobs, and names each step over the threshold", () => {
    expect(summariseRun(run, 60).jobs).toEqual([
      {
        name: "Build static site",
        minutes: 20,
        slowSteps: [{ name: "Run npm run build", seconds: 1120 }],
      },
      { name: "Playwright (Chromium, WebKit)", minutes: 12, slowSteps: [] },
    ]);
  });

  it("times a run still in progress up to its last finished job", () => {
    const running: Run = {
      ...run,
      conclusion: "",
      jobs: [
        ...run.jobs,
        {
          name: "Lighthouse (mobile budget)",
          conclusion: "",
          startedAt: "2026-11-11T22:21:00Z",
          completedAt: "0001-01-01T00:00:00Z",
          steps: [],
        },
      ],
    };

    const summary = summariseRun(running, 60);

    expect(summary.minutes).toBe(33);
    expect(summary.jobs.map((job) => job.name)).not.toContain(
      "Lighthouse (mobile budget)"
    );
  });

  it("gives a run with no finished job no time", () => {
    const summary = summariseRun({ ...run, jobs: [] }, 60);

    expect(summary.minutes).toBeUndefined();
    expect(summary.queuedSeconds).toBeUndefined();
  });
});

describe("formatCiTimes", () => {
  it("prints each run, then its jobs with their slow steps", () => {
    expect(formatCiTimes([summariseRun(run, 60)])).toBe(
      [
        "11-11 22:00  some-branch (pull_request, success)  33 min, queued 30 s  #42",
        "  Build static site                          20 min  Run npm run build 1120 s",
        "  Playwright (Chromium, WebKit)              12 min",
      ].join("\n")
    );
  });

  it("keeps only the jobs whose name contains a filter", () => {
    expect(formatCiTimes([summariseRun(run, 60)], "playwright")).toBe(
      [
        "11-11 22:00  some-branch (pull_request, success)  33 min, queued 30 s  #42",
        "  Playwright (Chromium, WebKit)              12 min",
      ].join("\n")
    );
  });

  it("says a run without a conclusion is in progress", () => {
    expect(
      formatCiTimes([summariseRun({ ...run, conclusion: "" }, 60)], "none")
    ).toBe(
      "11-11 22:00  some-branch (pull_request, in progress)  33 min, queued 30 s  #42"
    );
  });

  it("marks a re-run, whose total spans the wait before it", () => {
    expect(
      formatCiTimes([summariseRun({ ...run, attempt: 2 }, 60)], "none")
    ).toBe(
      "11-11 22:00  some-branch (pull_request, success)  33 min over 2 attempts, queued 30 s  #42"
    );
  });

  it("marks a run with no finished job", () => {
    expect(formatCiTimes([summariseRun({ ...run, jobs: [] }, 60)])).toBe(
      "11-11 22:00  some-branch (pull_request, success)  no finished job  #42"
    );
  });
});

describe("readRun", () => {
  it("reads what `gh run view --json` prints", () => {
    expect(readRun(JSON.parse(JSON.stringify(run)))).toEqual(run);
  });

  it("names the field it can't read", () => {
    expect(() => readRun({ ...run, createdAt: 7 })).toThrow(
      "gh run view printed no string at createdAt"
    );
    expect(() =>
      readRun({ ...run, jobs: [{ ...run.jobs[0], steps: [{ name: 1 }] }] })
    ).toThrow("gh run view printed no string at jobs.0.steps.0.name");
    expect(() => readRun({ ...run, jobs: "none" })).toThrow(
      "gh run view printed no list at jobs"
    );
    expect(() => readRun({ ...run, attempt: "1" })).toThrow(
      "gh run view printed no number at attempt"
    );
    expect(() => readRun(null)).toThrow(
      "gh run view printed no number at databaseId"
    );
  });
});
