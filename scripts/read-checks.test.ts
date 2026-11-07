/**
 * @jest-environment node
 */
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const script = join(__dirname, "read-checks.sh");

// Stand-ins on the PATH: gh answers with the next line of `answers`, each
// "<exit> <output>", repeating the last, and sleep only counts.
function fakes(answers: string[]) {
  const root = mkdtempSync(join(tmpdir(), "read-checks-"));
  const count = join(root, "count");
  const sleeps = join(root, "sleeps");
  writeFileSync(count, "0");
  writeFileSync(sleeps, "");
  writeFileSync(join(root, "answers"), answers.join("\n") + "\n");
  writeFileSync(
    join(root, "gh"),
    `#!/bin/bash
n=$(($(cat "${count}") + 1))
echo "$n" > "${count}"
line=$(sed -n "$n"p "${root}/answers")
[[ -n $line ]] || line=$(tail -1 "${root}/answers")
[[ -n \${line#* } && \${line#* } != "$line" ]] && echo "\${line#* }"
[[ \${line#* } == "$line" ]] && echo "error connecting to api.github.com" >&2
exit "\${line%% *}"
`
  );
  writeFileSync(join(root, "sleep"), `#!/bin/sh\necho slept >> "${sleeps}"\n`);
  chmodSync(join(root, "gh"), 0o755);
  chmodSync(join(root, "sleep"), 0o755);
  const run = () =>
    spawnSync("bash", [script, "7"], {
      env: { ...process.env, PATH: `${root}${delimiter}${process.env.PATH}` },
      encoding: "utf8",
    });
  const sleepCount = () =>
    readFileSync(sleeps, "utf8").split("\n").filter(Boolean).length;
  return { root, run, sleepCount };
}

describe("read-checks", () => {
  let f: ReturnType<typeof fakes>;
  afterEach(() => {
    rmSync(f.root, { recursive: true, force: true });
  });

  it("reads through a network drop, then reports the checks", () => {
    f = fakes(["1", "1", "0 Lint workflows\tpass"]);

    const result = f.run();

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("Lint workflows\tpass\n");
    expect(f.sleepCount()).toBe(2);
  });

  it("reports a failed check at once, as gh exits 1 for it too", () => {
    f = fakes(["1 Lint workflows\tfail"]);

    const result = f.run();

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("Lint workflows\tfail\n");
    expect(f.sleepCount()).toBe(0);
  });

  it("passes on gh's exit 8 for pending checks", () => {
    f = fakes(["8 Lint workflows\tpending"]);

    const result = f.run();

    expect(result.status).toBe(8);
    expect(f.sleepCount()).toBe(0);
  });

  it("gives up, saying so, when GitHub stays out of reach", () => {
    f = fakes(["1"]);

    const result = f.run();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Couldn't read #7's checks");
    expect(f.sleepCount()).toBe(29);
  });
});
