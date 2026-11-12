/**
 * @jest-environment node
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MISSING_BUILD, refuseMissingBuild } from "./missing-build";

describe("refuseMissingBuild", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "missing-build-"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("names the build command when out/ is missing", () => {
    expect(() => refuseMissingBuild(root)).toThrow(MISSING_BUILD);
    expect(MISSING_BUILD).toContain("npm run build");
  });

  it("refuses an out/ with no home page, as a failed build leaves it", () => {
    mkdirSync(join(root, "out"));
    expect(() => refuseMissingBuild(root)).toThrow(MISSING_BUILD);
  });

  it("passes once out/ holds a built site", () => {
    mkdirSync(join(root, "out"));
    writeFileSync(join(root, "out", "index.html"), "<!doctype html>");
    expect(() => refuseMissingBuild(root)).not.toThrow();
  });
});
