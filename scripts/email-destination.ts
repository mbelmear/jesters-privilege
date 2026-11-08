// The production deploy's Email Routing check (#114): fails the deploy unless
// wrangler.jsonc's send_email destination is a verified Email Routing
// destination address. The logic is src/lib/email-destination.ts; this wires
// in the network, the config file, and the workflow's environment.
// Usage: CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… npm run email-destination
// (run by .github/workflows/deploy.yml before wrangler deploy)
import { readFileSync } from "node:fs";
import { runEmailDestinationCheck } from "@/lib/email-destination";

const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!apiToken || !accountId) {
  console.log(
    "::error::Email Routing check needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID"
  );
  process.exitCode = 1;
} else {
  runEmailDestinationCheck(readFileSync("wrangler.jsonc", "utf8"), {
    fetch: (url, init) =>
      fetch(url, { ...init, signal: AbortSignal.timeout(30_000) }),
    accountId,
    apiToken,
    log: (line) => console.log(line),
  }).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    }
  );
}
