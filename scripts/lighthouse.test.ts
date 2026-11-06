/**
 * @jest-environment node
 */
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const script = join(__dirname, "lighthouse.sh");

// A stand-in for npx on the PATH: logs each call, writes a report for collect
// and autorun, and notes which reports autorun found already there.
function run(args: string[] = [], collectStatus = 0) {
  const dir = mkdtempSync(join(tmpdir(), "lighthouse-"));
  const bin = join(dir, "bin");
  mkdirSync(bin);
  writeFileSync(
    join(bin, "npx"),
    `#!/bin/sh
echo "$*" >> calls.log
case "$*" in
  "lhci collect"*)
    mkdir -p .lighthouseci
    touch .lighthouseci/lhr-warm-up.json
    exit ${collectStatus} ;;
  "lhci autorun"*)
    ls .lighthouseci 2>/dev/null > found-by-autorun.log
    mkdir -p .lighthouseci
    touch .lighthouseci/lhr-measured.json ;;
esac
`
  );
  chmodSync(join(bin, "npx"), 0o755);
  const result = spawnSync("bash", [script, ...args], {
    cwd: dir,
    env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}` },
    encoding: "utf8",
  });
  const calls = readFileSync(join(dir, "calls.log"), "utf8").trim().split("\n");
  const found = readFileSync(join(dir, "found-by-autorun.log"), "utf8").trim();
  rmSync(dir, { recursive: true, force: true });
  return { status: result.status, calls, found };
}

describe("lighthouse", () => {
  it("runs the first page once, unmeasured, before measuring", () => {
    const { calls } = run();
    expect(calls[0]).toBe(
      "lhci collect --collect.url=http://localhost/ --collect.numberOfRuns=1"
    );
    expect(calls[1]).toBe("lhci autorun");
  });

  it("keeps the warm-up's report out of what is asserted", () => {
    expect(run().found).toBe("");
  });

  it("still measures when the warm-up fails, which reports the cause", () => {
    const { status, calls } = run([], 1);
    expect(status).toBe(0);
    expect(calls[1]).toBe("lhci autorun");
  });

  it("measures only the pages named", () => {
    expect(run(["/404.html"]).calls[1]).toBe(
      "lhci autorun --collect.url=http://localhost/404.html"
    );
  });
});
