/**
 * @jest-environment node
 */
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scriptsDir } from "../../paths";

const script = join(scriptsDir, "pinned-node.sh");

describe("the commit hooks' Node", () => {
  let root: string;

  // A stand-in node that answers --version as the real one does.
  function node(dir: string, version: string) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "node"), `#!/bin/sh\necho ${version}\n`);
    chmodSync(join(dir, "node"), 0o755);
  }

  // Sources the script as a hook does, then reports the node it left first
  // on PATH.
  function hook({ shellNode, nvm }: { shellNode?: string; nvm: string[] }) {
    const shellBin = join(root, "shell-bin");
    mkdirSync(shellBin, { recursive: true });
    if (shellNode) node(shellBin, shellNode);
    for (const version of nvm) {
      node(join(root, "nvm", "versions", "node", version, "bin"), version);
    }
    return spawnSync("sh", ["-e", "-c", `. "${script}"; node --version`], {
      cwd: root,
      env: {
        ...process.env,
        PATH: `${shellBin}:/usr/bin:/bin`,
        NVM_DIR: join(root, "nvm"),
        HOME: root,
      },
      encoding: "utf8",
    });
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "pinned-node-"));
    writeFileSync(join(root, ".nvmrc"), "24\n");
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("keeps the shell's node when it is the major .nvmrc pins", () => {
    const result = hook({ shellNode: "v24.22.1", nvm: ["v22.23.5"] });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("v24.22.1");
  });

  it("switches to nvm's install of the pinned major when the shell runs another", () => {
    const result = hook({
      shellNode: "v26.13.1",
      nvm: ["v22.23.5", "v24.22.1"],
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("v24.22.1");
  });

  it("stops the hook, saying how to get the pinned major, when nvm has none", () => {
    const result = hook({ shellNode: "v26.13.1", nvm: ["v22.23.5"] });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      "Node 26 runs this, and .nvmrc pins 24, which CI runs.\n" +
        "Install it (`nvm install`) or switch to it (`nvm use`), then run it again.\n"
    );
  });

  it("names a shell with no node at all", () => {
    const result = hook({ nvm: [] });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Node (none) runs this,");
  });

  it("reads a full version in .nvmrc as its major", () => {
    writeFileSync(join(root, ".nvmrc"), "v24.22.1\n");
    const result = hook({ shellNode: "v26.13.1", nvm: ["v24.22.1"] });
    expect(result.stdout.trim()).toBe("v24.22.1");
  });
});
