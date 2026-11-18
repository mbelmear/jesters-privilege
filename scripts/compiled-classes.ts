// Prints every class Tailwind compiles into the stylesheet every page loads,
// one per line, read as the build reads it: globals.css and the files it
// scans. docs/compiled-classes.txt holds the list; refresh it with
//   npm run compiled-classes > docs/compiled-classes.txt
// (keeping its header). Run as a script, since @tailwindcss/node registers
// module hooks that Jest refuses. It and @tailwindcss/oxide come with
// @tailwindcss/turbopack, the build's own, so both compile with one version.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { classesIn } from "../src/lib/compiled-classes";

async function main() {
  const entry = join(__dirname, "../src/app/globals.css");
  const compiler = await compile(readFileSync(entry, "utf8"), {
    base: dirname(entry),
    onDependency: () => {},
  });
  const root =
    compiler.root && compiler.root !== "none"
      ? [{ ...compiler.root, negated: false }]
      : [];
  const scanner = new Scanner({ sources: [...root, ...compiler.sources] });
  console.log(classesIn(compiler.build(scanner.scan())).join("\n"));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
