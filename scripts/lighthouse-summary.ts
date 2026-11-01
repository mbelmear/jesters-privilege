// Prints a summary of Lighthouse reports, one column per label, for
// scripts/lighthouse.sh, scripts/lighthouse-compare.sh, and CI's downloaded
// lighthouse-reports (src/lib/lighthouse.ts). Each argument is
// <label>=<folder of reports>. Each page's LCP budget comes from
// lighthouserc.json.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  readLcpBudgets,
  readReport,
  summarise,
  type Column,
} from "@/lib/lighthouse";

// A Lighthouse report as lhci collect names it (lhr-*.json) or as its
// filesystem upload does (*.report.json), not lhci's manifest or assertion
// results beside them.
function isReport(file: string): boolean {
  return /^lhr-.*\.json$/.test(file) || file.endsWith(".report.json");
}

function lcpBudgets(): (path: string) => number {
  const file = join(import.meta.dirname, "..", "lighthouserc.json");
  const json: unknown = JSON.parse(readFileSync(file, "utf8"));
  return readLcpBudgets(file, json);
}

const columns: Column[] = process.argv.slice(2).map((arg) => {
  const split = arg.indexOf("=");
  if (split < 1) throw new Error(`Expected <label>=<folder>, not "${arg}"`);
  const folder = arg.slice(split + 1);
  return {
    label: arg.slice(0, split),
    reports: readdirSync(folder)
      .filter(isReport)
      .map((file) => {
        const json: unknown = JSON.parse(
          readFileSync(join(folder, file), "utf8")
        );
        return readReport(file, json);
      }),
  };
});

console.log(summarise(columns, { lcpBudgetFor: lcpBudgets() }));
