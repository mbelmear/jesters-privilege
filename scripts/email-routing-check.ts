// Nightly's Email Routing check (#159): fails the run when wrangler.jsonc's
// send_email destination isn't a verified Email Routing destination, or hello@
// doesn't forward to it alone. The logic is src/lib/email-routing-check.ts;
// this wires in the network, the config file, and the workflow's environment.
// Usage: CLOUDFLARE_READ_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… npm run email-routing-check
// The token is read-only (docs/deploy.md, Account prerequisites).
import { readFileSync } from "node:fs";
import { site } from "@/content/site";
import { errorMessage } from "@/lib/download";
import {
  EMAIL_ROUTING_FAILURE,
  runEmailRoutingCheck,
} from "@/lib/email-routing-check";

const apiToken = process.env.CLOUDFLARE_READ_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!apiToken || !accountId) {
  console.log(
    `::error::${EMAIL_ROUTING_FAILURE}: it needs CLOUDFLARE_READ_TOKEN and CLOUDFLARE_ACCOUNT_ID`
  );
  process.exitCode = 1;
} else {
  // A crash keeps the failure prefix, so the nightly report names it.
  const crashed = (error: unknown) => {
    console.log(`::error::${EMAIL_ROUTING_FAILURE}: ${errorMessage(error)}`);
    process.exitCode = 1;
  };
  let config: string | undefined;
  try {
    config = readFileSync("wrangler.jsonc", "utf8");
  } catch (error: unknown) {
    crashed(error);
  }
  if (config !== undefined) {
    runEmailRoutingCheck(config, {
      fetch: (url, init) =>
        fetch(url, { ...init, signal: AbortSignal.timeout(30_000) }),
      apiToken,
      accountId,
      alias: site.contactEmail,
      log: (line) => console.log(line),
    }).then((code) => {
      process.exitCode = code;
    }, crashed);
  }
}
