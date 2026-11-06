// Prints a Playwright trace as one timeline, so an agent can read a CI failure
// without the show-trace GUI. The logic is src/lib/trace-summary.ts. It unzips
// the trace into a new temporary folder and leaves it there, since the timeline
// names the screencast frames in it to open.
// Usage: npm run trace -- <trace.zip>
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { summariseTrace } from "@/lib/trace-summary";

const zip = process.argv[2];
if (!zip) throw new Error("Usage: npm run trace -- <trace.zip>");

const folder = mkdtempSync(join(tmpdir(), "trace-"));
execFileSync("unzip", ["-q", zip, "-d", folder], { stdio: "inherit" });
const files = readdirSync(folder)
  .filter((name) => /\.(trace|network)$/.test(name))
  .map((name) => ({ name, text: readFileSync(join(folder, name), "utf8") }));
console.log(summariseTrace(files, folder));
