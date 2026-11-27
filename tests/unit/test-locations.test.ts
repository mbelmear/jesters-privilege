/**
 * @jest-environment node
 */
import { existsSync, globSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../paths";

// Tests live under tests/, so src/ and scripts/ hold only the code itself
// (docs/testing.md, Unit and component tests).
describe("test locations", () => {
  it.each(["src", "scripts"])("puts no test or spec file in %s/", (dir) => {
    const misplaced = globSync(
      `${dir}/**/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs}`,
      {
        cwd: repoRoot,
      }
    ).map((path) =>
      /\.spec\.\w+$/.test(path)
        ? `${path}: move it under tests/e2e/`
        : `${path}: move it to tests/unit/${path.replace(/^src\//, "")}`
    );
    expect(misplaced).toEqual([]);
  });

  it("keeps browser tests in tests/e2e, not a top-level e2e/", () => {
    expect(existsSync(join(repoRoot, "e2e"))).toBe(false);
  });
});
