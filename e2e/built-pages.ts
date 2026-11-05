import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

// The pages in out/, found on disk so a page added later is checked too.

const OUT = join(__dirname, "..", "out");

// Each page's address, from its file: out/about.html is /about.
function builtPages(dir = OUT): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return builtPages(path);
    if (!entry.name.endsWith(".html")) return [];
    const address = `/${relative(OUT, path).replace(/\.html$/, "")}`;
    return [address === "/index" ? "/" : address];
  });
}

// The 404 page is served for every unknown address, at none of its own.
export const pages = builtPages().filter(
  (path) => !["/404", "/_not-found"].includes(path)
);

// A page search engines may list: one that doesn't say noindex.
export const indexable = pages.filter(
  (path) =>
    !/<meta name="robots" content="noindex/.test(
      readFileSync(join(OUT, `${path === "/" ? "/index" : path}.html`), "utf8")
    )
);
