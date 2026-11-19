// The repo paths a document names, so a check can fail on one that's gone
// (tests/unit/paths-exist.test.ts). Markdown is read whole; code only in its
// comments, since its strings are often made-up paths for a test.

const TOP_FOLDERS = ["src", "scripts", "tests", "docs", "public", ".github"];

// A path starts at one of the top folders, not partway through a longer path
// or URL. The whole token is read before it's judged, so a pattern or a
// placeholder (`{ts,tsx}`, `<path>`, `${name}`) is skipped rather than cut
// down to a shorter path, and trailing punctuation is trimmed.
const TOKEN = new RegExp(
  `(?<![\\w./@:-])(?:${TOP_FOLDERS.map((f) => f.replace(".", "\\.")).join("|")})/[\\w./*\\[\\]{}<>$,-]*`,
  "g"
);
const PLACEHOLDER = /[{}<>$]/;
const TRAILING = /[.,/-]+$/;

export function namedPaths(
  text: string,
  format: "markdown" | "code"
): string[] {
  const read = format === "markdown" ? text : comments(text);
  return [...read.matchAll(TOKEN)]
    .map(([token]) => token)
    .filter((token) => !PLACEHOLDER.test(token))
    .map((token) => token.replace(TRAILING, ""))
    .filter((path) => path.includes("/"));
}

// The comment text of code: `/* … */` blocks, and `//` or `# ` to the end
// of a line.
function comments(code: string): string {
  const found: string[] = [];
  let inBlock = false;
  for (const line of code.split("\n")) {
    let rest = line;
    while (rest.length > 0) {
      if (inBlock) {
        const end = rest.indexOf("*/");
        found.push(end === -1 ? rest : rest.slice(0, end));
        if (end === -1) break;
        inBlock = false;
        rest = rest.slice(end + 2);
        continue;
      }
      const start = /(?<!\S)\/\*|(?<!\S)\/\/|(?<!\S)# /.exec(rest);
      if (!start) break;
      if (start[0] === "/*") {
        inBlock = true;
        rest = rest.slice(start.index + 2);
      } else {
        found.push(rest.slice(start.index));
        break;
      }
    }
  }
  return found.join("\n");
}
