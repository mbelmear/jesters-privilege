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
// "<exit> <stdout>", or "<exit> ERR <stderr>", or just "<exit>" for a dropped
// connection, repeating the last, and sleep only counts.
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
text=\${line#* }
if [[ $text == "$line" ]]; then
  echo "error connecting to api.github.com" >&2
elif [[ $text == ERR* ]]; then
  echo "\${text#ERR }" >&2
else
  echo "$text"
fi
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

  // The first three are what gh printed with the network cut off (gh 2.103.3).
  it.each([
    "error connecting to api.github.com",
    'Post "https://api.github.com/graphql": dial tcp 127.0.0.1:1: connect: connection refused',
    'Post "https://api.github.com/graphql": dial tcp 10.255.255.1:443: i/o timeout',
    'Post "https://api.github.com/graphql": read tcp: connection reset by peer',
    'Post "https://api.github.com/graphql": EOF',
    "net/http: TLS handshake timeout",
  ])("reads again after: %s", (error) => {
    f = fakes([`1 ERR ${error}`, "0 Lint workflows\tpass"]);

    const result = f.run();

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("Lint workflows\tpass\n");
    expect(f.sleepCount()).toBe(1);
  });

  it("reports a failed check at once, as gh exits 1 for it too", () => {
    f = fakes(["1 Lint workflows\tfail"]);

    const result = f.run();

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("Lint workflows\tfail\n");
    expect(f.sleepCount()).toBe(0);
  });

  it("stops at once at any other error, passing it on", () => {
    f = fakes(["1 ERR no checks reported on the 'ticket' branch"]);

    const result = f.run();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("no checks reported");
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
    expect(result.stderr).toContain("Couldn't reach GitHub");
    expect(f.sleepCount()).toBe(29);
  });
});
