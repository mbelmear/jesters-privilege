// Summarises Lighthouse reports, one column per label (a checkout, or CI's
// downloaded reports), for scripts/lighthouse-summary.ts.

// The parts of a Lighthouse report the summary reads. Times in ms.
export type Report = {
  path: string;
  simulatedLcp: number;
  simulatedFcp: number;
  observedLcp: number;
  observedFcp: number;
  // What the largest paint was, such as "img.size-full" or "p.max-w-prose":
  // an image waits on its own request as well as the early bytes.
  lcpElement: string;
  requests: { url: string; startTime: number; type: string; bytes: number }[];
};

// One label's reports: three runs of each page, as Lighthouse CI takes them.
export type Column = { label: string; reports: Report[] };

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
export function readReport(file: string, json: unknown): Report {
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
  // Read before the requests, so a report missing a figure says which.
  const times = {
    simulatedLcp: numberAt(
      "audits",
      "largest-contentful-paint",
      "numericValue"
    ),
    simulatedFcp: numberAt("audits", "first-contentful-paint", "numericValue"),
    observedLcp: metric("observedLargestContentfulPaint"),
    observedFcp: metric("observedFirstContentfulPaint"),
  };
  if (!Array.isArray(items)) throw new Error(`${file} has no network requests`);
  const requests: unknown[] = items;
  return {
    path: new URL(url).pathname,
    ...times,
    lcpElement: typeof element === "string" ? element : "unknown",
    requests: requests.map((request) => {
      const url = dig(request, ["url"]);
      const type = dig(request, ["resourceType"]);
      const startTime = dig(request, ["rendererStartTime"]);
      const bytes = dig(request, ["transferSize"]);
      return {
        url: typeof url === "string" ? url : "",
        type: typeof type === "string" ? type : "Other",
        startTime: typeof startTime === "number" ? startTime : Infinity,
        bytes: typeof bytes === "number" ? bytes : 0,
      };
    }),
  };
}

// The largest-paint budget a Lighthouse CI config (lighthouserc.json) asserts.
export function readLcpBudget(file: string, json: unknown): number {
  const budget = dig(json, [
    "ci",
    "assert",
    "assertions",
    "largest-contentful-paint",
    1,
    "maxNumericValue",
  ]);
  if (typeof budget !== "number") {
    throw new Error(`${file} sets no largest-contentful-paint maxNumericValue`);
  }
  return budget;
}

// A request fetched before the observed paint: what the simulated paint times
// track.
function isEarly(
  { startTime }: Report["requests"][number],
  report: Report
): boolean {
  return startTime <= report.observedLcp;
}

const BYTES = " bytes";

// About one simulated round trip: the step a simulated time moves in, so a run
// this close to the budget can cross it on a few hundred more bytes.
const STEP_MS = 150;

// The figures shown for one report: times in ms, and the bytes of each type
// fetched before the paint, exactly: a page on a simulated-time step crosses
// it on a few hundred bytes, which whole KB hide (#23).
function figures(report: Report): Record<string, number> {
  const early: Record<string, number> = {};
  for (const request of report.requests) {
    if (!isEarly(request, report)) continue;
    const key = `early ${request.type}${BYTES}`;
    early[key] = (early[key] ?? 0) + request.bytes;
  }
  return {
    "LCP (simulated)": report.simulatedLcp,
    "LCP (observed)": report.observedLcp,
    "FCP (simulated)": report.simulatedFcp,
    "FCP (observed)": report.observedFcp,
    ...early,
  };
}

// The font files fetched before the paint, by name and size in KB, so a
// surprise file shows where the font total only shows a sum (#57).
function earlyFonts(report: Report): [string, number][] {
  return report.requests
    .filter((request) => request.type === "Font" && isEarly(request, report))
    .map(({ url, bytes }) => [fileName(url), bytes / 1000]);
}

// Every file fetched before the paint, by name, with its bytes.
function earlyFiles(reports: Report[]): Map<string, number> {
  const files = new Map<string, number>();
  for (const report of reports) {
    for (const request of report.requests) {
      if (isEarly(request, report))
        files.set(fileName(request.url), request.bytes);
    }
  }
  return files;
}

// The last part of a file's address, or its whole path for a page at a
// folder's address, such as the home page's "/".
function fileName(url: string): string {
  const path = URL.canParse(url) ? new URL(url).pathname : url;
  return path.split("/").pop() || path;
}

function median(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

// 12876 as "12,876".
function thousands(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function format(key: string, value: number): string {
  return key.endsWith(BYTES) ? thousands(value) : value.toFixed(0);
}

// The median of each figure across one page's runs.
function medians(runs: Report[]): Record<string, number> {
  const rows = runs.map(figures);
  const keys = new Set(rows.flatMap((row) => Object.keys(row)));
  return Object.fromEntries(
    [...keys].map((key) => [key, median(rows.map((row) => row[key] ?? 0))])
  );
}

const line = (cells: string[]) =>
  cells.map((cell) => cell.padStart(22)).join("");

// One label's runs of one page, with the figures shown for them.
type Side = {
  label: string;
  runs: Report[];
  medianFigures: Record<string, number>;
  files: Map<string, number>;
};

/** The summary as printed: each page's figures, one column per label. */
export function summarise(
  columns: Column[],
  { lcpBudget }: { lcpBudget: number }
): string {
  const paths = new Set(
    columns.flatMap(({ reports }) => reports.map((report) => report.path))
  );
  const out: string[] = [];
  for (const path of paths) {
    const sides: Side[] = columns.map(({ label, reports }) => {
      const runs = reports.filter((report) => report.path === path);
      return {
        label,
        runs,
        medianFigures: medians(runs),
        files: earlyFiles(runs),
      };
    });
    out.push("", path, ...figureRows(sides));
    for (const { label, runs } of sides) {
      out.push(`    LCP element (${label}): ${runs[0]?.lcpElement ?? "–"}`);
    }
    for (const { label, runs } of sides) {
      const fonts = new Map(runs.flatMap(earlyFonts));
      const list = [...fonts].map(
        ([name, kb]) => `${name} ${kb.toFixed(0)} KB`
      );
      out.push(`    early fonts (${label}): ${list.join(", ") || "–"}`);
    }
    for (const { label, runs } of sides) {
      const lcps = runs.map((report) => report.simulatedLcp);
      if (lcps.some((lcp) => lcp >= lcpBudget - STEP_MS)) {
        out.push(
          `    near the LCP budget (${label}): runs of ${lcps.map(thousands).join(", ")} ms against ${thousands(lcpBudget)}`
        );
      }
    }
    if (sides.length > 1) out.push(...fileChanges(sides));
  }
  return out.join("\n");
}

// A row per figure, a cell per side.
function figureRows(sides: Side[]): string[] {
  const keys = new Set(
    sides.flatMap(({ medianFigures }) => Object.keys(medianFigures))
  );
  return [
    line(["", ...sides.map(({ label }) => label)]),
    ...[...keys].sort().map((key) =>
      line([
        key,
        ...sides.map(({ medianFigures }) => {
          const value = medianFigures[key];
          return value === undefined ? "–" : format(key, value);
        }),
      ])
    ),
  ];
}

// Which early files changed between the sides. A bundler renames a file whose
// contents change, so each side lists the files only it fetched and the
// reader pairs them; a file that keeps its name, such as the page's own
// document, shows its bytes on each side.
function fileChanges(sides: Side[]): string[] {
  const out: string[] = [];
  const names = new Set(sides.flatMap(({ files }) => [...files.keys()]));
  const changed = [...names].flatMap((name) => {
    const sizes = sides.map(({ files }) => files.get(name));
    const known = sizes.filter((bytes) => bytes !== undefined);
    if (known.length < sizes.length || new Set(known).size === 1) return [];
    return [`${name} ${known.map(thousands).join(" → ")}`];
  });
  if (changed.length > 0) {
    out.push(`    early files changed: ${changed.join(", ")}`);
  }
  for (const { label, files } of sides) {
    const others = sides.filter((side) => side.label !== label);
    const only = [...files].filter(([name]) =>
      others.every((side) => !side.files.has(name))
    );
    if (only.length === 0) continue;
    const list = only.map(([name, bytes]) => `${name} ${thousands(bytes)}`);
    out.push(`    early files only in ${label}: ${list.join(", ")}`);
  }
  return out;
}
