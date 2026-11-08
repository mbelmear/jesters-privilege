// The deploy's Email Routing check (#114): the Worker's send_email binding
// only delivers to a verified Email Routing destination, so a production
// deploy first asks the Cloudflare API whether wrangler.jsonc's
// destination_address is one. No test or deploy step could tell otherwise:
// Jest fakes the sender, a preview accepts any address, and the smoke check
// can't pass Turnstile. Run by scripts/email-destination.ts in
// .github/workflows/deploy.yml. Nightly's Email Routing check
// (src/lib/email-routing-check.ts) checks it again between deploys, reading
// wrangler.jsonc and Cloudflare's lists through the same functions.
import JSON5 from "json5";
import { errorMessage, type Fetch, type TextResponse } from "./download";

export type EmailDestinationEnv = {
  // Reads the Cloudflare API.
  fetch: Fetch;
  accountId: string;
  // Sent only in the Authorization header; never logged.
  apiToken: string;
  // Workflow-command log lines (::notice::, ::error::).
  log: (line: string) => void;
};

// Where a Jester verifies a destination address.
const DASHBOARD_PATH =
  "Compute › Email Service › Email Routing › Destination Addresses";

// Returns the exit code: 0 when every send_email destination in `config`
// (wrangler.jsonc's text) is verified, 1 with an ::error:: otherwise.
export async function runEmailDestinationCheck(
  config: string,
  env: EmailDestinationEnv
): Promise<number> {
  let addresses: string[];
  let listed: Destination[];
  try {
    addresses = destinationAddresses(config);
    listed = await destinationList(
      {
        fetch: env.fetch,
        apiToken: env.apiToken,
        tokenName: "CLOUDFLARE_API_TOKEN",
      },
      env.accountId
    );
  } catch (error: unknown) {
    env.log(
      `::error::Email Routing check failed, so nothing deploys: ${errorMessage(error)}`
    );
    return 1;
  }
  let code = 0;
  for (const address of addresses) {
    const destination = listed.find(({ email }) => email === address);
    if (destination?.verified) {
      env.log(`::notice::${address} is a verified Email Routing destination`);
      continue;
    }
    code = 1;
    env.log(
      destination
        ? `::error::${address} is an Email Routing destination address that isn't verified yet, ${CONSEQUENCE}. Follow the link in the verification email Cloudflare sent it; the Cloudflare dashboard shows its status under ${DASHBOARD_PATH}.`
        : `::error::${address} isn't an Email Routing destination address, ${CONSEQUENCE}. Add and verify it in the Cloudflare dashboard under ${DASHBOARD_PATH}.`
    );
  }
  return code;
}

const CONSEQUENCE = "so every Submission would fail with the delivery error";

// Every send_email binding's destination_address, or an error saying why
// there's none to check.
export function destinationAddresses(config: string): string[] {
  let value: unknown;
  try {
    value = JSON5.parse(config);
  } catch (error: unknown) {
    throw new Error(`wrangler.jsonc isn't JSONC: ${errorMessage(error)}`);
  }
  const sendEmail: unknown =
    typeof value === "object" && value !== null && "send_email" in value
      ? value.send_email
      : undefined;
  const bindings: unknown[] = Array.isArray(sendEmail) ? sendEmail : [];
  if (bindings.length === 0) {
    throw new Error(
      "wrangler.jsonc has no send_email binding with a destination_address"
    );
  }
  return bindings.map((binding, i) => {
    if (
      typeof binding === "object" &&
      binding !== null &&
      "destination_address" in binding &&
      typeof binding.destination_address === "string"
    ) {
      return binding.destination_address;
    }
    const name =
      typeof binding === "object" &&
      binding !== null &&
      "name" in binding &&
      typeof binding.name === "string"
        ? binding.name
        : String(i);
    throw new Error(
      `wrangler.jsonc's send_email binding ${name} has no destination_address`
    );
  });
}

// A destination address, and whether its owner has verified it.
export type Destination = { email: string; verified: boolean };

// How to read the Cloudflare API: the token goes only in the Authorization
// header, never into a log line or error.
export type CloudflareApi = {
  fetch: Fetch;
  apiToken: string;
  // The secret the token comes from, named when Cloudflare refuses it.
  tokenName: string;
};

// The API's largest page (its docs' per_page maximum).
const PER_PAGE = 50;

// Every destination address on the account.
export function destinationList(
  api: CloudflareApi,
  accountId: string
): Promise<Destination[]> {
  return cloudflareList(
    api,
    {
      what: "Email Routing addresses",
      path: `/accounts/${accountId}/email/routing/addresses`,
      permission: "Account › Email Routing Addresses: Read",
    },
    destination
  );
}

// One list the API pages: what it is (named in errors), its path under
// /client/v4 (a query string allowed), and the permission a refused token
// lacks.
export type CloudflareListRequest = {
  what: string;
  path: string;
  permission: string;
};

// Every item of a list, each narrowed by `parse` (given the item and how to
// name it in an error), read a page at a time until a page comes back short.
export async function cloudflareList<T>(
  api: CloudflareApi,
  request: CloudflareListRequest,
  parse: (item: unknown, source: string) => T
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL(`https://api.cloudflare.com/client/v4${request.path}`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(PER_PAGE));
    const source = `${request.what} ${url.href}`;
    const result = await cloudflarePage(api, request, url.href, source);
    items.push(
      ...result.map((item, i) => parse(item, `${source} result ${i}`))
    );
    if (result.length < PER_PAGE) return items;
  }
  throw new Error(
    `${request.what} listed more than ${MAX_PAGES} pages of ${PER_PAGE}, so the API's paging can't be trusted`
  );
}

// Far more items than the show will ever have: an API that ignored `page`
// would otherwise be read until the job timed out.
const MAX_PAGES = 20;

// The statuses Cloudflare answers a token it won't take with: 400 for one it
// can't authenticate, 403 for one without the permission.
const TOKEN_REFUSED = [400, 401, 403];

async function cloudflarePage(
  api: CloudflareApi,
  request: CloudflareListRequest,
  url: string,
  source: string
): Promise<unknown[]> {
  let response: TextResponse;
  try {
    response = await api.fetch(url, {
      headers: { Authorization: `Bearer ${api.apiToken}` },
    });
  } catch (error: unknown) {
    throw new Error(`${source} couldn't be reached: ${errorMessage(error)}`);
  }
  const text = await response.text();
  if (!response.ok) {
    const hint = TOKEN_REFUSED.includes(response.status)
      ? `. ${api.tokenName} needs ${request.permission} (docs/deploy.md, Account prerequisites).`
      : "";
    throw new Error(
      `${source} answered ${response.status} ${response.statusText}: ${describeErrors(apiErrors(text))}${hint}`
    );
  }
  return parseResult(text, source);
}

// An answer's errors list, or none when the answer isn't the API's JSON.
function apiErrors(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null && "errors" in value
      ? value.errors
      : [];
  } catch {
    return [];
  }
}

// The result list in one page of the API's answer, or an error naming
// `source` and what was wrong with it.
function parseResult(text: string, source: string): unknown[] {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`${source} isn't JSON`);
  }
  if (typeof value !== "object" || value === null) {
    throw new Error(`${source} isn't a JSON object`);
  }
  if (!("success" in value) || value.success !== true) {
    const errors: unknown = "errors" in value ? value.errors : [];
    throw new Error(`${source} reported failure: ${describeErrors(errors)}`);
  }
  const result: unknown = "result" in value ? value.result : undefined;
  if (!Array.isArray(result)) {
    throw new Error(`${source} has no result list`);
  }
  const items: unknown[] = result;
  return items;
}

// One destination address from the API's list, or an error naming `source`.
function destination(item: unknown, source: string): Destination {
  if (
    typeof item !== "object" ||
    item === null ||
    !("email" in item) ||
    typeof item.email !== "string"
  ) {
    throw new Error(`${source} has no email`);
  }
  // A timestamp once verified; null until then.
  const verified: unknown = "verified" in item ? item.verified : null;
  if (verified !== null && typeof verified !== "string") {
    throw new Error(`${source} has a verified that's neither a date nor null`);
  }
  return { email: item.email, verified: verified !== null };
}

// The API's errors as "code message" pairs, for an error message.
function describeErrors(errors: unknown): string {
  const list: unknown[] = Array.isArray(errors) ? errors : [];
  const described = list.map((error) =>
    typeof error === "object" && error !== null
      ? [
          "code" in error ? String(error.code) : "",
          "message" in error ? String(error.message) : "",
        ]
          .filter(Boolean)
          .join(" ")
      : String(error)
  );
  return described.length > 0 ? described.join("; ") : "no errors given";
}
