// Where a CI run's time goes: each run's total, its wait for a runner, each
// job's time, and the steps over a threshold. scripts/ci-times.ts reads the
// runs through `gh` and prints this. #158 measured it by hand from 120 runs.

type Timed = {
  readonly name: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
};

export type Run = {
  readonly databaseId: number;
  readonly headBranch: string;
  readonly event: string;
  readonly conclusion: string;
  readonly createdAt: string;
  readonly jobs: readonly (Timed & {
    readonly conclusion: string;
    readonly steps: readonly Timed[];
  })[];
};

export type RunSummary = {
  readonly id: number;
  readonly branch: string;
  readonly event: string;
  readonly conclusion: string;
  readonly createdAt: string;
  readonly minutes: number | undefined;
  readonly queuedSeconds: number | undefined;
  readonly jobs: readonly {
    readonly name: string;
    readonly minutes: number;
    readonly slowSteps: readonly { name: string; seconds: number }[];
  }[];
};

// Reads a run as `gh run view --json` prints it, naming any field it can't.
export function readRun(json: unknown): Run {
  const at = (value: unknown, key: string): unknown =>
    typeof value === "object" && value !== null && key in value
      ? Object.entries(value).find(([name]) => name === key)?.[1]
      : undefined;
  const fail = (kind: string, path: string): never => {
    throw new Error(`gh run view printed no ${kind} at ${path}`);
  };
  const string = (value: unknown, key: string, path = key): string => {
    const found = at(value, key);
    return typeof found === "string" ? found : fail("string", path);
  };
  const time = (value: unknown, key: string, path: string): string | null => {
    const found = at(value, key);
    return found === null ? null : string(value, key, path);
  };
  const list = (value: unknown, key: string, path = key): unknown[] => {
    const found = at(value, key);
    return Array.isArray(found) ? found : fail("list", path);
  };
  const timed = (value: unknown, path: string) => ({
    name: string(value, "name", `${path}.name`),
    startedAt: time(value, "startedAt", `${path}.startedAt`),
    completedAt: time(value, "completedAt", `${path}.completedAt`),
  });

  const databaseId = at(json, "databaseId");
  return {
    databaseId:
      typeof databaseId === "number"
        ? databaseId
        : fail("number", "databaseId"),
    headBranch: string(json, "headBranch"),
    event: string(json, "event"),
    conclusion: string(json, "conclusion"),
    createdAt: string(json, "createdAt"),
    jobs: list(json, "jobs").map((job, j) => ({
      ...timed(job, `jobs.${j}`),
      conclusion: string(job, "conclusion", `jobs.${j}.conclusion`),
      steps: list(job, "steps", `jobs.${j}.steps`).map((step, s) =>
        timed(step, `jobs.${j}.steps.${s}`)
      ),
    })),
  };
}

// GitHub writes the year 1 for a time that never happened, such as a step
// that didn't run.
const time = (iso: string | null) =>
  iso && !iso.startsWith("0001-") ? Date.parse(iso) : undefined;

const seconds = ({ startedAt, completedAt }: Timed) => {
  const start = time(startedAt);
  const end = time(completedAt);
  return start === undefined || end === undefined
    ? undefined
    : Math.round((end - start) / 1000);
};

export function summariseRun(run: Run, slowStepSeconds: number): RunSummary {
  const finished = run.jobs.filter(
    (job) => job.conclusion !== "skipped" && seconds(job) !== undefined
  );
  const created = Date.parse(run.createdAt);
  const ends = finished.map((job) => time(job.completedAt) ?? created);
  const starts = finished.map((job) => time(job.startedAt) ?? created);

  return {
    id: run.databaseId,
    branch: run.headBranch,
    event: run.event,
    conclusion: run.conclusion,
    createdAt: run.createdAt,
    minutes: finished.length
      ? Math.round((Math.max(...ends) - created) / 60_000)
      : undefined,
    queuedSeconds: finished.length
      ? Math.round((Math.min(...starts) - created) / 1000)
      : undefined,
    jobs: finished.map((job) => ({
      name: job.name,
      minutes: Math.round((seconds(job) ?? 0) / 60),
      slowSteps: job.steps.flatMap((step) => {
        const took = seconds(step);
        return took !== undefined && took > slowStepSeconds
          ? [{ name: step.name, seconds: took }]
          : [];
      }),
    })),
  };
}

export function formatCiTimes(
  runs: readonly RunSummary[],
  jobFilter?: string
): string {
  return runs
    .flatMap((run) => {
      const when = `${run.createdAt.slice(5, 10)} ${run.createdAt.slice(11, 16)}`;
      const took =
        run.minutes === undefined
          ? "no finished job"
          : `${run.minutes} min, queued ${run.queuedSeconds} s`;
      const jobs = run.jobs
        .filter(
          (job) =>
            !jobFilter ||
            job.name.toLowerCase().includes(jobFilter.toLowerCase())
        )
        .map((job) =>
          [
            `  ${job.name.padEnd(42)}${String(job.minutes).padStart(3)} min`,
            ...job.slowSteps.map((step) => `${step.name} ${step.seconds} s`),
          ].join("  ")
        );
      return [
        `${when}  ${run.branch} (${run.event}, ${run.conclusion || "in progress"})  ${took}  #${run.id}`,
        ...jobs,
      ];
    })
    .join("\n");
}
