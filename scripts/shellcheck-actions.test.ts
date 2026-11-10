/**
 * @jest-environment node
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(__dirname, "shellcheck-actions.ts");
const run = (...paths: string[]) =>
  spawnSync("npx", ["tsx", script, ...paths], { encoding: "utf8" });

describe("shellcheck-actions", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "shellcheck-actions-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function action(name: string, steps: string) {
    mkdirSync(join(root, name));
    writeFileSync(
      join(root, name, "action.yml"),
      `name: ${name}\ndescription: A sample.\nruns:\n  using: composite\n  steps:\n${steps}`
    );
  }

  // #198 shipped this line: the apostrophe opens a quote bash never closes.
  it("refuses a run: block that doesn't parse, naming the action and step", () => {
    action("good", "    - shell: bash\n      run: echo hello\n");
    action(
      "bad",
      `    - id: version\n      shell: bash\n      run: |\n        echo "image=\${ImageOS:?so it can't}" >> "$GITHUB_OUTPUT"\n`
    );

    const result = run(root);

    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("bad/action.yml");
    expect(result.stdout + result.stderr).toContain("version");
    expect(result.stdout + result.stderr).not.toContain("good/action.yml");
  });

  it("reads ${{ }} expressions as plain words", () => {
    action(
      "expressions",
      '    - shell: bash\n      run: echo "${{ inputs.browsers }}" > "${{ runner.temp }}/out"\n'
    );

    const result = run(root);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("passes the repo's own actions", () => {
    const result = run(".github/actions");

    expect(result.stdout + result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("checks an action.yml it's handed by name, as the commit hook does", () => {
    action("bad", '    - shell: bash\n      run: echo "unclosed\n');

    expect(run(join(root, "bad", "action.yml")).status).not.toBe(0);
  });
});
