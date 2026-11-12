import { formatTestTimes, readReport, summariseTests } from "./test-times";

const test = (projectName: string, status: string, ...durations: number[]) => ({
  projectName,
  status,
  results: durations.map((duration) => ({ duration })),
});

// The shape `playwright test --reporter=json` writes, trimmed to what's read.
const report = {
  suites: [
    {
      title: "sweep.spec.ts",
      file: "sweep.spec.ts",
      specs: [],
      suites: [
        {
          title: "Every button",
          specs: [
            {
              title: "keeps its contrast while hovered (light)",
              tests: [
                test("chromium-desktop", "expected", 8900),
                test("chromium-phone", "skipped"),
              ],
            },
          ],
        },
      ],
    },
    {
      title: "theme.spec.ts",
      file: "theme.spec.ts",
      specs: [
        {
          title: "starts light",
          tests: [
            test("chromium-desktop", "expected", 1000),
            // A retry's time is worker time too.
            test("chromium-phone", "flaky", 2000, 1500),
          ],
        },
      ],
    },
  ],
};

describe("readReport", () => {
  it("names each test by its file and describe blocks, per project", () => {
    expect(readReport(report)).toEqual([
      {
        title:
          "sweep.spec.ts › Every button › keeps its contrast while hovered (light)",
        project: "chromium-desktop",
        skipped: false,
        seconds: 8.9,
      },
      {
        title:
          "sweep.spec.ts › Every button › keeps its contrast while hovered (light)",
        project: "chromium-phone",
        skipped: true,
        seconds: 0,
      },
      {
        title: "theme.spec.ts › starts light",
        project: "chromium-desktop",
        skipped: false,
        seconds: 1,
      },
      {
        title: "theme.spec.ts › starts light",
        project: "chromium-phone",
        skipped: false,
        seconds: 3.5,
      },
    ]);
  });

  it("names the field it can't read", () => {
    expect(() => readReport({ suites: [{ title: "a.spec.ts" }] })).toThrow(
      "Playwright's report has no list at suites[0].specs"
    );
  });
});

describe("summariseTests", () => {
  const summary = summariseTests(readReport(report), 5);

  it("totals each project's run and skipped tests and worker-seconds", () => {
    expect(summary.projects).toEqual([
      { project: "chromium-desktop", run: 2, skipped: 0, seconds: 9.9 },
      { project: "chromium-phone", run: 1, skipped: 1, seconds: 3.5 },
    ]);
  });

  it("lists the tests over the threshold in any project, slowest first, with each project's time", () => {
    expect(summary.slowTests).toEqual([
      {
        title:
          "sweep.spec.ts › Every button › keeps its contrast while hovered (light)",
        seconds: { "chromium-desktop": 8.9, "chromium-phone": undefined },
      },
    ]);
  });
});

describe("formatTestTimes", () => {
  it("prints the projects' totals, then the slow tests with a column per project", () => {
    expect(formatTestTimes(summariseTests(readReport(report), 5))).toBe(
      [
        "project             run  skipped  worker-s",
        "chromium-desktop      2        0       9.9",
        "chromium-phone        1        1       3.5",
        "",
        "Tests over 5 s in any project (s; - is skipped or not run):",
        "chromium-desktop  chromium-phone",
        "             8.9               -  sweep.spec.ts › Every button › keeps its contrast while hovered (light)",
      ].join("\n")
    );
  });
});
