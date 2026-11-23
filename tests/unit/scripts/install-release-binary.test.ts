/**
 * @jest-environment node
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scriptsDir } from "../../paths";

const script = join(scriptsDir, "install-release-binary.sh");

// A release archive holding tool-v1/tool, served from disk over file://.
function release(dir: string) {
  const src = join(dir, "src", "tool-v1");
  mkdirSync(src, { recursive: true });
  // Big enough that one install's download and checks overlap another's.
  writeFileSync(
    join(src, "tool"),
    `#!/bin/sh\necho tool ok\n#${"x".repeat(4_000_000)}\n`,
    { mode: 0o755 }
  );
  const archive = join(dir, "tool-v1.tar.gz");
  spawnSync("tar", ["-czf", archive, "-C", join(dir, "src"), "tool-v1/tool"]);
  const sha = createHash("sha256").update(readFileSync(archive)).digest("hex");
  return { url: `file://${archive}`, sha };
}

function install(args: string[]) {
  return new Promise<{ status: number | null; stderr: string }>((resolve) => {
    const child = spawn("bash", [script, ...args]);
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("close", (status) => resolve({ status, stderr }));
  });
}

describe("install-release-binary", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "install-release-binary-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  // #274's first commit failed: Jest ran suites in parallel on a fresh
  // worktree, two of them downloaded shellcheck into the same file at once,
  // and each read the other's half-written archive as a checksum mismatch.
  it("installs the binary when eight installs start at once on an empty cache", async () => {
    const { url, sha } = release(dir);
    const bin = join(dir, "cache", "tool");

    const results = await Promise.all(
      Array.from({ length: 8 }, () => install([url, sha, "tool-v1/tool", bin]))
    );

    expect(results.map((r) => r.stderr)).toEqual(Array(8).fill(""));
    expect(results.map((r) => r.status)).toEqual(Array(8).fill(0));
    expect(spawnSync(bin, { encoding: "utf8" }).stdout).toBe("tool ok\n");
  });

  it("refuses an archive that doesn't match the checksum, installing nothing", async () => {
    const { url } = release(dir);
    const bin = join(dir, "cache", "tool");

    const result = await install([url, "0".repeat(64), "tool-v1/tool", bin]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "tool-v1.tar.gz doesn't match its pinned checksum"
    );
    expect(existsSync(bin)).toBe(false);
  });
});
