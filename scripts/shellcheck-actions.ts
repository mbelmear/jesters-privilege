// Shellchecks each `run:` block in the composite actions, which actionlint
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

const shellcheck = join(__dirname, "shellcheck.sh");

function actionFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path)
    .map((name) => join(path, name, "action.yml"))
    .filter((file) => existsSync(file));
}

function steps(action: unknown): unknown[] {
  if (typeof action !== "object" || action === null || !("runs" in action))
    return [];
  const { runs } = action;
  if (typeof runs !== "object" || runs === null || !("steps" in runs))
    return [];
  const list: unknown = runs.steps;
  return Array.isArray(list) ? list : [];
}

function field(step: object, key: string): unknown {
  const value: unknown = Reflect.get(step, key);
  return value;
}

type Block =
  | { label: string; dialect: "bash" | "sh"; script: string }
  | { label: string; problem: string };

// Every run: block is checked or refused: one passing unchecked is #181's gap.
function runBlocks(file: string): Block[] {
  return steps(parse(readFileSync(file, "utf8"))).flatMap<Block>(
    (step, index) => {
      if (typeof step !== "object" || step === null) return [];
      const run = field(step, "run");
      if (run === undefined) return [];
      const id = field(step, "id") ?? field(step, "name");
      const label = `${relative(".", file)}, step ${index + 1}${typeof id === "string" ? ` (${id})` : ""}`;
      const shell = String(field(step, "shell") ?? "");
      const dialect = /^bash(\s|$)/.test(shell)
        ? "bash"
        : /^sh(\s|$)/.test(shell)
          ? "sh"
          : undefined;
      if (typeof run !== "string")
        return [{ label, problem: "its run: isn't text" }];
      if (!dialect)
        return [
          {
            label,
            problem: `shellcheck can't check shell: ${shell || "(none)"}`,
          },
        ];
      return [
        {
          label,
          dialect,
          script: run.replace(/\$\{\{[\s\S]*?\}\}/g, (expression) =>
            "_".repeat(expression.length)
          ),
        },
      ];
    }
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
  for (const block of paths.flatMap(actionFiles).flatMap(runBlocks)) {
    if ("problem" in block) {
      failed = true;
      console.error(`${block.label}: ${block.problem}`);
      continue;
    }
    const file = join(scratch, "step.sh");
    writeFileSync(file, block.script);
    // -s bash with no shebang keeps shellcheck's line numbers the block's own.
    const result = spawnSync(
      shellcheck,
      ["--severity=warning", "-s", block.dialect, file],
      { encoding: "utf8" }
    );
    if (result.status !== 0) {
      failed = true;
      console.error(`${block.label}:\n${result.stdout}${result.stderr}`);
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
