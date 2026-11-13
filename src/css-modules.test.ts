/**
 * @jest-environment node
 */
import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";

// A CSS module is plain CSS (CODING_STANDARDS.md, Performance): next.config.ts
// keeps `*.module.css` out of Tailwind's loader (#92), so Tailwind syntax in
// one would reach the browser uncompiled. Jest can't see that: next/jest maps
// every module to an identity proxy.
const src = __dirname;
const modules = globSync("**/*.module.css", { cwd: src }).sort();

const TAILWIND = ["@apply", "@reference", "theme("];

test("finds the CSS modules, the style guide's specimen among them", () => {
  expect(modules).toContain("app/styleguide/module-specimen.module.css");
});

test.each(modules)("src/%s is plain CSS, with no Tailwind syntax", (file) => {
  const css = readFileSync(join(src, file), "utf8");
  const found = TAILWIND.filter((syntax) => css.includes(syntax));
  expect({ file: `src/${file}`, tailwind: found }).toEqual({
    file: `src/${file}`,
    tailwind: [],
  });
});
