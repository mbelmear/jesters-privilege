// Nightly's Email Routing check (#159): fails the run when the Gmail in
// wrangler.jsonc isn't a verified Email Routing destination, or hello@ doesn't
// forward to it alone. The logic is src/lib/email-routing-check.ts; this wires
// in Cloudflare's API and the workflow.
// Usage: CLOUDFLARE_READ_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… npm run email-routing-check
// The token is read-only (docs/deploy.md, Account prerequisites) and goes only
// into the Authorization header, never into a log line or error.
import { readFileSync } from "node:fs";
import ts from "typescript";
import { site } from "@/content/site";
import { errorMessage } from "@/lib/download";
import {
  EMAIL_ROUTING_FAILURE,
  runEmailRoutingCheck,
  submissionDestination,
} from "@/lib/email-routing-check";

const API = "https://api.cloudflare.com/client/v4";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} isn't set`);
  return value;
}

// wrangler.jsonc is JSON with comments and trailing commas, which
// TypeScript's own config reader parses.
function wranglerConfig(): unknown {
  const parsed = ts.parseConfigFileTextToJson(
    "wrangler.jsonc",
    readFileSync("wrangler.jsonc", "utf8")
  );
  if (parsed.error) throw new Error("wrangler.jsonc isn't valid JSONC");
  const config: unknown = parsed.config;
  return config;
}

async function main(): Promise<number> {
  const token = required("CLOUDFLARE_READ_TOKEN");
  const alias = site.contactEmail;
  return runEmailRoutingCheck({
    accountId: required("CLOUDFLARE_ACCOUNT_ID"),
    zone: alias.slice(alias.indexOf("@") + 1),
    alias,
    destination: submissionDestination(wranglerConfig()),
    get: async (path) => {
      const response = await fetch(`${API}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(30_000),
      });
      const body: unknown = await response.json().catch(() => null);
      return { status: response.status, body };
    },
    log: (line) => console.log(line),
  });
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.log(`::error::${EMAIL_ROUTING_FAILURE}: ${errorMessage(error)}`);
    process.exitCode = 1;
  }
);
