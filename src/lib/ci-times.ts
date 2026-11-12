// Where a CI run's time goes: each run's total, its wait for a runner, each
// job's time, and the steps over a threshold. scripts/ci-times.ts reads the
// runs through `gh` and prints this. #158 measured it by hand from 120 runs.

type Timed = {
  readonly name: string;
  readonly startedAt: string;
  readonly completedAt: string;
};

export type Run = {
  readonly databaseId: number;
  readonly headBranch: string;
  readonly event: string;
  readonly conclusion: string;
  readonly createdAt: string;
  // A re-run keeps the jobs it didn't repeat, timed from the first attempt.
  readonly attempt: number;
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
  readonly attempts: number;
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
  const number = (value: unknown, key: string): number => {
    const found = at(value, key);
    return typeof found === "number" ? found : fail("number", key);
  };
  const list = (value: unknown, key: string, path = key): unknown[] => {
    const found = at(value, key);
    return Array.isArray(found) ? found : fail("list", path);
  };
  const timed = (value: unknown, path: string) => ({
    name: string(value, "name", `${path}.name`),
    startedAt: string(value, "startedAt", `${path}.startedAt`),
    completedAt: string(value, "completedAt", `${path}.completedAt`),
  });

  return {
    databaseId: number(json, "databaseId"),
    headBranch: string(json, "headBranch"),
    event: string(json, "event"),
    conclusion: string(json, "conclusion"),
    createdAt: string(json, "createdAt"),
    attempt: number(json, "attempt"),
    jobs: list(json, "jobs").map((job, j) => ({
      ...timed(job, `jobs.${j}`),
      conclusion: string(job, "conclusion", `jobs.${j}.conclusion`),
      steps: list(job, "steps", `jobs.${j}.steps`).map((step, s) =>
        timed(step, `jobs.${j}.steps.${s}`)
      ),
    })),
  };
}

// `gh run view` prints the year 1 for a time that hasn't happened: a step
// that didn't run, or a job still running.
const epochMs = (iso: string) =>
  iso.startsWith("0001-") ? undefined : Date.parse(iso);

const seconds = ({ startedAt, completedAt }: Timed) => {
  const start = epochMs(startedAt);
  const end = epochMs(completedAt);
  return start === undefined || end === undefined
    ? undefined
    : Math.round((end - start) / 1000);
};

export function summariseRun(run: Run, slowStepSeconds: number): RunSummary {
  const finished = run.jobs.flatMap((job) => {
    const start = epochMs(job.startedAt);
    const end = epochMs(job.completedAt);
    return job.conclusion !== "skipped" &&
      start !== undefined &&
      end !== undefined
      ? [{ ...job, start, end }]
      : [];
  });
  const created = Date.parse(run.createdAt);
  const ends = finished.map((job) => job.end);
  const starts = finished.map((job) => job.start);

  return {
    id: run.databaseId,
    branch: run.headBranch,
    event: run.event,
    conclusion: run.conclusion,
    createdAt: run.createdAt,
    attempts: run.attempt,
    minutes: finished.length
      ? Math.round((Math.max(...ends) - created) / 60_000)
      : undefined,
    queuedSeconds: finished.length
      ? Math.round((Math.min(...starts) - created) / 1000)
      : undefined,
    jobs: finished.map((job) => ({
      name: job.name,
      minutes: Math.round((job.end - job.start) / 60_000),
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
          : `${run.minutes} min${run.attempts > 1 ? ` over ${run.attempts} attempts` : ""}, queued ${run.queuedSeconds} s`;
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
