// Where a Playwright run's time goes, per test and per project, from the report
// `playwright test --reporter=json` writes. scripts/test-times.ts runs a spec
// and prints this. #210's triage guessed a hover test's phone time from its
// desktop one (9 s, not 3 s); this measures each.

export type TestTime = {
  readonly title: string;
  readonly project: string;
  readonly skipped: boolean;
  readonly seconds: number;
};

export type TestTimesSummary = {
  readonly threshold: number;
  readonly projects: readonly {
    readonly project: string;
    readonly run: number;
    readonly skipped: number;
    readonly seconds: number;
  }[];
  readonly slowTests: readonly {
    readonly title: string;
    // undefined where the project skipped or didn't run the test.
    readonly seconds: Readonly<Record<string, number | undefined>>;
  }[];
};

const tenths = (seconds: number) => Math.round(seconds * 10) / 10;

// Reads the report, naming any field it can't.
export function readReport(json: unknown): TestTime[] {
  const at = (value: unknown, key: string): unknown =>
    typeof value === "object" && value !== null && key in value
      ? Object.entries(value).find(([name]) => name === key)?.[1]
      : undefined;
  const fail = (kind: string, path: string): never => {
    throw new Error(`Playwright's report has no ${kind} at ${path}`);
  };
  const string = (value: unknown, key: string, path: string): string => {
    const found = at(value, key);
    return typeof found === "string" ? found : fail("string", path);
  };
  const list = (value: unknown, key: string, path: string): unknown[] => {
    const found = at(value, key);
    return Array.isArray(found) ? found : fail("list", path);
  };
  // A file's suite lists its specs; nested describe blocks may omit theirs.
  const optionalList = (value: unknown, key: string, path: string) =>
    at(value, key) === undefined ? [] : list(value, key, path);

  const fromSuite = (
    suite: unknown,
    path: string,
    titles: readonly string[],
    isFile: boolean
  ): TestTime[] => {
    const inside = [...titles, string(suite, "title", `${path}.title`)];
    const specs = isFile
      ? list(suite, "specs", `${path}.specs`)
      : optionalList(suite, "specs", `${path}.specs`);
    return [
      ...specs.flatMap((spec, s) => {
        const specPath = `${path}.specs[${s}]`;
        const title = [
          ...inside,
          string(spec, "title", `${specPath}.title`),
        ].join(" › ");
        return list(spec, "tests", `${specPath}.tests`).map((test, t) => {
          const testPath = `${specPath}.tests[${t}]`;
          const results = list(test, "results", `${testPath}.results`);
          const ms = results.reduce<number>((sum, result, r) => {
            const duration = at(result, "duration");
            return typeof duration === "number"
              ? sum + duration
              : fail("number", `${testPath}.results[${r}].duration`);
          }, 0);
          return {
            title,
            project: string(test, "projectName", `${testPath}.projectName`),
            skipped: string(test, "status", `${testPath}.status`) === "skipped",
            seconds: ms / 1000,
          };
        });
      }),
      ...optionalList(suite, "suites", `${path}.suites`).flatMap((inner, i) =>
        fromSuite(inner, `${path}.suites[${i}]`, inside, false)
      ),
    ];
  };

  return list(json, "suites", "suites").flatMap((suite, i) =>
    fromSuite(suite, `suites[${i}]`, [], true)
  );
}

// Each project's totals, and every test over `threshold` seconds in any
// project, slowest first.
export function summariseTests(
  times: readonly TestTime[],
  threshold: number
): TestTimesSummary {
  const projects = [...new Set(times.map((time) => time.project))].sort();
  const titles = [...new Set(times.map((time) => time.title))];
  const ran = (time: TestTime) => !time.skipped;

  const slowTests = titles
    .map((title) => {
      const own = times.filter((time) => time.title === title && ran(time));
      return {
        title,
        slowest: Math.max(0, ...own.map((time) => time.seconds)),
        seconds: Object.fromEntries(
          projects.map((project) => {
            const time = own.find((t) => t.project === project);
            return [project, time && tenths(time.seconds)];
          })
        ),
      };
    })
    .filter((test) => test.slowest > threshold)
    .sort((a, b) => b.slowest - a.slowest)
    .map(({ title, seconds }) => ({ title, seconds }));

  return {
    threshold,
    projects: projects.map((project) => {
      const own = times.filter((time) => time.project === project);
      return {
        project,
        run: own.filter(ran).length,
        skipped: own.filter((time) => time.skipped).length,
        seconds: tenths(own.reduce((sum, time) => sum + time.seconds, 0)),
      };
    }),
    slowTests,
  };
}

export function formatTestTimes(summary: TestTimesSummary): string {
  const width = Math.max(
    "project".length,
    ...summary.projects.map(({ project }) => project.length)
  );
  const row = (project: string, run: string, skipped: string, s: string) =>
    `${project.padEnd(width)}  ${run.padStart(5)}  ${skipped.padStart(7)}  ${s.padStart(8)}`;
  const names = summary.projects.map(({ project }) => project);
  return [
    row("project", "run", "skipped", "worker-s"),
    ...summary.projects.map(({ project, run, skipped, seconds }) =>
      row(project, `${run}`, `${skipped}`, seconds.toFixed(1))
    ),
    "",
    `Tests over ${summary.threshold} s in any project (s; - is skipped or not run):`,
    names.join("  "),
    ...summary.slowTests.map(({ title, seconds }) =>
      [
        ...names.map((name) =>
          (seconds[name]?.toFixed(1) ?? "-").padStart(name.length)
        ),
        title,
      ].join("  ")
    ),
  ].join("\n");
}
