// Prints where recent CI runs spent their time: each run's total and wait for
// a runner, each job's minutes, and every step over the threshold. The logic
// is src/lib/ci-times.ts; this reads the runs through `gh`, newest first.
// Usage: npm run ci-times -- [--workflow ci.yml] [--limit 20] [--branch <b>]
//          [--job <part of a job's name>] [--slow <seconds, default 60>]
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { formatCiTimes, readRun, summariseRun } from "@/lib/ci-times";

const { values } = parseArgs({
  options: {
    workflow: { type: "string", default: "ci.yml" },
    limit: { type: "string", default: "20" },
    branch: { type: "string" },
    job: { type: "string" },
    slow: { type: "string", default: "60" },
  },
});

const gh = (...args: string[]) =>
  execFileSync("gh", args, { encoding: "utf8", maxBuffer: 1 << 28 });

const ids = gh(
  "run",
  "list",
  `--workflow=${values.workflow}`,
  `--limit=${values.limit}`,
  ...(values.branch ? [`--branch=${values.branch}`] : []),
  "--json=databaseId",
  "--jq=.[].databaseId"
)
  .split("\n")
  .filter(Boolean);

const runs = ids.map((id) => {
  const json: unknown = JSON.parse(
    gh(
      "run",
      "view",
      id,
      "--json=databaseId,headBranch,event,conclusion,createdAt,jobs"
    )
  );
  return readRun(json);
});

console.log(
  formatCiTimes(
    runs.map((run) => summariseRun(run, Number(values.slow))),
    values.job
  )
);
