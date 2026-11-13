/**
 * @jest-environment node
 */
import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tailwindIn, themeVariables } from "@/lib/css-module";

// A CSS module is plain CSS on :root's tokens (CODING_STANDARDS.md,
// Performance). next.config.ts keeps `*.module.css` out of Tailwind's loader
// (#92), so Tailwind syntax in one reaches the browser uncompiled; and since
// Tailwind still scans modules for names, a theme variable one uses lands in
// every page's stylesheet (#92's first specimen, with `--radius-sm`). next/jest
// maps every module to an identity proxy, so before a lighthouse:compare run
// only this check sees either.
const src = __dirname;
const modules = globSync("**/*.module.css", { cwd: src }).sort();

// Read by path: under Jest, resolving a .css file gives Next's style mock.
const read = (path: string) => readFileSync(join(src, path), "utf8");
const globals = read("app/globals.css");
// The stylesheet holding the theme of each package globals.css imports.
const imported: Record<string, string> = {
  tailwindcss: "tailwindcss/theme.css",
  "tw-animate-css": "tw-animate-css/dist/tw-animate.css",
  "shadcn/tailwind.css": "shadcn/dist/tailwind.css",
};
const theme = new Set(
  [
    globals,
    ...Object.values(imported).map((f) => read(`../node_modules/${f}`)),
  ].flatMap((css) => [...themeVariables(css)])
);

test("reads the theme of every package globals.css imports", () => {
  const imports = [...globals.matchAll(/@import\s+"([^"]+)"/g)].map(
    ([, name]) => name
  );
  expect(imports.sort()).toEqual(Object.keys(imported).sort());
});

test("knows the site's and its packages' theme variables", () => {
  expect(theme).toContain("--radius-sm");
  expect(theme).toContain("--spacing");
  expect(theme).toContain("--animate-in");
  expect(theme).not.toContain("--radius");
});

test("finds the CSS modules, the style guide's specimen among them", () => {
  expect(modules).toContain("app/styleguide/module-specimen.module.css");
});

test.each(modules)("src/%s is plain CSS on :root's tokens", (file) => {
  expect({
    file: `src/${file}`,
    tailwind: tailwindIn(read(file), theme),
  }).toEqual({ file: `src/${file}`, tailwind: [] });
});
