// Summarises Lighthouse reports, one column per label, for
// scripts/lighthouse-compare.sh. Each argument is <label>=<folder of lhr JSON>.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

type Row = { url: string; values: Record<string, number> };

// Walks a path through parsed report JSON; undefined where it's absent.
function dig(value: unknown, ...path: (string | number)[]): unknown {
  let node = value;
  for (const key of path) {
    if (typeof node !== "object" || node === null) return undefined;
    const child: unknown = Reflect.get(node, key);
    node = child;
  }
  return node;
}

function at(value: unknown, ...path: (string | number)[]): number {
  const node = dig(value, ...path);
  return typeof node === "number" ? node : NaN;
}

function list(value: unknown, ...path: string[]): unknown[] {
  const node = dig(value, ...path);
  return Array.isArray(node) ? node.map((item: unknown) => item) : [];
}

function text(value: unknown, key: string): string {
  const node = dig(value, key);
  return typeof node === "string" ? node : "";
}

// One report's figures: times in ms, sizes in KB.
function figures(report: unknown): Row {
  const audits = ["audits"];
  const metrics = [...audits, "metrics", "details", "items", 0];
  const observedLcp = at(report, ...metrics, "observedLargestContentfulPaint");
  const early: Record<string, number> = {};
  for (const request of list(
    report,
    ...audits,
    "network-requests",
    "details",
    "items"
  )) {
    if (at(request, "rendererStartTime") > observedLcp) continue;
    const type = text(request, "resourceType") || "Other";
    early[type] = (early[type] ?? 0) + at(request, "transferSize") / 1000;
  }
  return {
    url: new URL(text(report, "finalDisplayedUrl")).pathname,
    values: {
      "LCP (simulated)": at(
        report,
        ...audits,
        "largest-contentful-paint",
        "numericValue"
      ),
      "LCP (observed)": observedLcp,
      "FCP (simulated)": at(
        report,
        ...audits,
        "first-contentful-paint",
        "numericValue"
      ),
      ...Object.fromEntries(
        Object.entries(early).map(([type, kb]) => [`early ${type} KB`, kb])
      ),
    },
  };
}

function median(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? NaN;
}

// Per label, per page: the median of each figure across runs.
const columns = process.argv.slice(2).map((arg) => {
  const [label, folder] = arg.split("=");
  if (!label || !folder)
    throw new Error(`Expected <label>=<folder>, not "${arg}"`);
  const byUrl = new Map<string, Row[]>();
  for (const file of readdirSync(folder).filter((f) => f.endsWith(".json"))) {
    const parsed: unknown = JSON.parse(
      readFileSync(join(folder, file), "utf8")
    );
    const row = figures(parsed);
    byUrl.set(row.url, [...(byUrl.get(row.url) ?? []), row]);
  }
  const pages = new Map<string, Record<string, number>>();
  for (const [url, rows] of byUrl) {
    const keys = new Set(rows.flatMap((row) => Object.keys(row.values)));
    pages.set(
      url,
      Object.fromEntries(
        [...keys].map((key) => [
          key,
          median(rows.map((row) => row.values[key] ?? 0)),
        ])
      )
    );
  }
  return { label, pages };
});

const urls = new Set(columns.flatMap(({ pages }) => [...pages.keys()]));
for (const url of urls) {
  console.log(`\n${url}`);
  const keys = new Set(
    columns.flatMap(({ pages }) => Object.keys(pages.get(url) ?? {}))
  );
  console.log(
    ["", ...columns.map(({ label }) => label)]
      .map((c) => c.padStart(18))
      .join("")
  );
  for (const key of [...keys].sort()) {
    const cells = columns.map(({ pages }) => {
      const value = pages.get(url)?.[key];
      return value === undefined || Number.isNaN(value)
        ? "–"
        : value.toFixed(0);
    });
    console.log([key, ...cells].map((c) => c.padStart(18)).join(""));
  }
}
