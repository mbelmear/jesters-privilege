/**
 * @jest-environment node
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Every page loads one stylesheet, so a class new to it is paid for by every
// page (CODING_STANDARDS.md, Performance). docs/compiled-classes.txt makes
// each one show in the diff that adds it, before review: #243's new row
// spacing reached every page and was seen only in a lighthouse:compare run
// after review. The list sits outside src/, since Tailwind compiles any class
// name in a file it scans, and a list there would keep compiling every class
// it names.
const root = join(__dirname, "..");

const listed = readFileSync(join(root, "docs/compiled-classes.txt"), "utf8")
  .split("\n")
  .filter((line) => line && !line.startsWith("#"));

it("compiles the classes docs/compiled-classes.txt lists, and no others", () => {
  const run = spawnSync(
    join(root, "node_modules/.bin/tsx"),
    ["scripts/compiled-classes.ts"],
    { cwd: root, encoding: "utf8" }
  );
  expect(run.stderr).toBe("");
  const compiled = run.stdout.split("\n").filter(Boolean);
  // added: paid for by every page; use a class the list has where one fits,
  // else add it to the list. gone: remove it from the list.
  const added = compiled.filter((name) => !listed.includes(name));
  const gone = listed.filter((name) => !compiled.includes(name));
  expect({ added, gone }).toEqual({ added: [], gone: [] });
});
