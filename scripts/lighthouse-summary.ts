// Summarises Lighthouse reports, one column per label, for
// scripts/lighthouse-compare.sh. Each argument is <label>=<folder of lhr JSON>.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The parts of a Lighthouse report the summary reads. Times in ms.
type Report = {
  path: string;
  simulatedLcp: number;
  simulatedFcp: number;
  observedLcp: number;
  observedFcp: number;
  // What the largest paint was, such as "img.size-full" or "p.max-w-prose":
  // an image waits on its own request as well as the early bytes.
  lcpElement: string;
  requests: { startTime: number; type: string; bytes: number }[];
};

// Walks a path through parsed JSON; undefined where it's absent.
function dig(value: unknown, path: readonly (string | number)[]): unknown {
  let node = value;
  for (const key of path) {
    if (typeof node !== "object" || node === null) return undefined;
    const child: unknown = Reflect.get(node, key);
    node = child;
  }
  return node;
}

// Narrows one parsed report, throwing with the file and field when a figure
// the summary needs is missing.
function readReport(file: string, json: unknown): Report {
  const numberAt = (...path: (string | number)[]): number => {
    const value = dig(json, path);
    if (typeof value !== "number") {
      throw new Error(`${file} has no number at ${path.join(".")}`);
    }
    return value;
  };
  const metric = (name: string) =>
    numberAt("audits", "metrics", "details", "items", 0, name);
  const url = dig(json, ["finalDisplayedUrl"]);
  if (typeof url !== "string") throw new Error(`${file} has no page URL`);
  const items = dig(json, ["audits", "network-requests", "details", "items"]);
  const element = dig(json, [
    "audits",
    "largest-contentful-paint-element",
    "details",
    "items",
    0,
    "items",
    0,
    "node",
    "selector",
  ]);
  const requests: unknown[] = Array.isArray(items) ? items : [];
  return {
    path: new URL(url).pathname,
    simulatedLcp: numberAt(
      "audits",
      "largest-contentful-paint",
      "numericValue"
    ),
    simulatedFcp: numberAt("audits", "first-contentful-paint", "numericValue"),
    observedLcp: metric("observedLargestContentfulPaint"),
    observedFcp: metric("observedFirstContentfulPaint"),
    lcpElement: typeof element === "string" ? element : "unknown",
    requests: requests.map((request) => {
      const type = dig(request, ["resourceType"]);
      const startTime = dig(request, ["rendererStartTime"]);
      const bytes = dig(request, ["transferSize"]);
      return {
        type: typeof type === "string" ? type : "Other",
        startTime: typeof startTime === "number" ? startTime : Infinity,
        bytes: typeof bytes === "number" ? bytes : 0,
      };
    }),
  };
}

// The figures shown for one report: times in ms, sizes in KB. The early bytes
// are what Lighthouse's simulated paint times track.
function figures(report: Report): Record<string, number> {
  const early: Record<string, number> = {};
  for (const { startTime, type, bytes } of report.requests) {
    if (startTime > report.observedLcp) continue;
    early[`early ${type} KB`] = (early[`early ${type} KB`] ?? 0) + bytes / 1000;
  }
  return {
    "LCP (simulated)": report.simulatedLcp,
    "LCP (observed)": report.observedLcp,
    "FCP (simulated)": report.simulatedFcp,
    "FCP (observed)": report.observedFcp,
    ...early,
  };
}

function median(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

// Per label, per page: the median of each figure across runs.
const columns = process.argv.slice(2).map((arg) => {
  const split = arg.indexOf("=");
  if (split < 1) throw new Error(`Expected <label>=<folder>, not "${arg}"`);
  const label = arg.slice(0, split);
  const folder = arg.slice(split + 1);
  const runs = new Map<string, Record<string, number>[]>();
  const elements = new Map<string, string>();
  for (const file of readdirSync(folder).filter((f) => f.endsWith(".json"))) {
    const json: unknown = JSON.parse(readFileSync(join(folder, file), "utf8"));
    const report = readReport(file, json);
    runs.set(report.path, [...(runs.get(report.path) ?? []), figures(report)]);
    elements.set(report.path, report.lcpElement);
  }
  const pages = new Map<string, Record<string, number>>();
  for (const [path, rows] of runs) {
    const keys = new Set(rows.flatMap((row) => Object.keys(row)));
    pages.set(
      path,
      Object.fromEntries(
        [...keys].map((key) => [key, median(rows.map((row) => row[key] ?? 0))])
      )
    );
  }
  return { label, pages, elements };
});

const line = (cells: string[]) =>
  cells.map((cell) => cell.padStart(18)).join("");

const paths = new Set(columns.flatMap(({ pages }) => [...pages.keys()]));
for (const path of paths) {
  console.log(`\n${path}`);
  console.log(line(["", ...columns.map(({ label }) => label)]));
  const keys = new Set(
    columns.flatMap(({ pages }) => Object.keys(pages.get(path) ?? {}))
  );
  for (const key of [...keys].sort()) {
    const cells = columns.map(({ pages }) => {
      const value = pages.get(path)?.[key];
      return value === undefined ? "–" : value.toFixed(0);
    });
    console.log(line([key, ...cells]));
  }
  for (const { label, elements } of columns) {
    console.log(`    LCP element (${label}): ${elements.get(path) ?? "–"}`);
  }
}
