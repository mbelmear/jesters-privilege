// Shellchecks each bash `run:` block in the composite actions, which actionlint
// never opens: it reads only workflows (#181). #198's cache step reached CI
// without parsing. Each block is checked as its own script, with every ${{ }}
// expression read as a plain word, as actionlint does for workflows.
// Usage: npx tsx scripts/shellcheck-actions.ts <dir of actions | action.yml>...
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { parse } from "yaml";

type Step = { id?: string; name?: string; shell?: string; run?: string };

const shellcheck = join(__dirname, "shellcheck.sh");

function actionFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path)
    .map((name) => join(path, name, "action.yml"))
    .filter((file) => existsSync(file));
}

function isComposite(action: unknown): action is { runs: { steps: Step[] } } {
  if (typeof action !== "object" || action === null || !("runs" in action))
    return false;
  const { runs } = action;
  return (
    typeof runs === "object" &&
    runs !== null &&
    "steps" in runs &&
    Array.isArray(runs.steps)
  );
}

function bashSteps(file: string): { label: string; script: string }[] {
  const action: unknown = parse(readFileSync(file, "utf8"));
  const steps = isComposite(action) ? action.runs.steps : [];
  return steps.flatMap((step, index) =>
    step.run && step.shell === "bash"
      ? [
          {
            label: `${relative(".", file)}, step ${index + 1}${step.id || step.name ? ` (${step.id ?? step.name})` : ""}`,
            script: step.run.replace(/\$\{\{[^}]*\}\}/g, (expression) =>
              "_".repeat(expression.length)
            ),
          },
        ]
      : []
  );
}

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error(
    "Usage: npx tsx scripts/shellcheck-actions.ts <dir of actions | action.yml>..."
  );
  process.exit(1);
}

const scratch = mkdtempSync(join(tmpdir(), "shellcheck-actions-"));
let failed = false;
try {
  for (const { label, script } of paths
    .flatMap(actionFiles)
    .flatMap(bashSteps)) {
    const file = join(scratch, "step.sh");
    writeFileSync(file, script);
    // -s bash with no shebang keeps shellcheck's line numbers the block's own.
    const result = spawnSync(
      shellcheck,
      ["--severity=warning", "-s", "bash", file],
      { encoding: "utf8" }
    );
    if (result.status !== 0) {
      failed = true;
      console.error(`${label}:\n${result.stdout}${result.stderr}`);
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
