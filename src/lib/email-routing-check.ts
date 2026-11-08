// Nightly's check of the Email Routing prerequisites (docs/deploy.md, Account
// prerequisites) that nothing else would notice until a visitor's Submission
// failed: the show's Gmail is a verified destination, and hello@ forwards to
// it alone (#113). The logic is here; scripts/email-routing-check.ts wires in
// Cloudflare's API with a read-only token, which never reaches this module.

/** What Cloudflare's API answered a GET with: the status and parsed JSON. */
export type CloudflareAnswer = { status: number; body: unknown };

export type EmailRoutingCheckEnv = {
  accountId: string;
  /** The zone whose routing rules hold the alias. */
  zone: string;
  /** The public address, such as hello@. */
  alias: string;
  /** Where Submissions go and the alias forwards (wrangler.jsonc). */
  destination: string;
  /** A GET of a path under https://api.cloudflare.com/client/v4. */
  get: (path: string) => Promise<CloudflareAnswer>;
  log: (line: string) => void;
};

type DestinationAddress = { email: string; verified: boolean };
type RoutingRule = {
  enabled: boolean;
  /** The address a literal `to` matcher names; null for any other rule. */
  to: string | null;
  actions: { type: string; value: string[] }[];
};

const PER_PAGE = 50;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function list(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${what} isn't a list`);
  const items: unknown[] = value;
  return items;
}

function text(value: unknown, what: string): string {
  if (typeof value !== "string") throw new Error(`${what} isn't text`);
  return value;
}

// Cloudflare's envelope: { success, errors, result, result_info }.
async function read(
  env: EmailRoutingCheckEnv,
  path: string
): Promise<{ result: unknown; totalPages: number }> {
  const { status, body } = await env.get(path);
  if (!isRecord(body)) {
    throw new Error(`Cloudflare answered ${path} with ${status} and no JSON`);
  }
  if (status < 200 || status >= 300 || body.success !== true) {
    const reasons = Array.isArray(body.errors)
      ? list(body.errors, "errors")
          .map((error) => (isRecord(error) ? error.message : undefined))
          .filter((message) => typeof message === "string")
      : [];
    throw new Error(
      `Cloudflare answered ${path} with ${status}${reasons.length ? `: ${reasons.join("; ")}` : ""}`
    );
  }
  const info = body.result_info;
  const totalPages =
    isRecord(info) && typeof info.total_pages === "number"
      ? info.total_pages
      : 1;
  return { result: body.result, totalPages };
}

// Every page of a list, PER_PAGE at a time.
async function readAll(
  env: EmailRoutingCheckEnv,
  path: string
): Promise<unknown[]> {
  const items: unknown[] = [];
  for (let page = 1; ; page++) {
    const pagePath = `${path}?page=${page}&per_page=${PER_PAGE}`;
    const { result, totalPages } = await read(env, pagePath);
    items.push(...list(result, `Cloudflare's answer to ${pagePath}`));
    if (page >= totalPages) return items;
  }
}

async function zoneId(env: EmailRoutingCheckEnv): Promise<string> {
  const path = `/zones?name=${env.zone}`;
  const zones = list(
    (await read(env, path)).result,
    `Cloudflare's answer to ${path}`
  );
  const zone = zones.find((item) => isRecord(item) && item.name === env.zone);
  if (!isRecord(zone)) {
    throw new Error(`The token can't see the zone ${env.zone}`);
  }
  return text(zone.id, `The zone ${env.zone}'s id`);
}

function destinationAddress(item: unknown): DestinationAddress {
  if (!isRecord(item)) throw new Error("A destination address isn't an object");
  return {
    email: text(item.email, "A destination address's email"),
    // A timestamp once verified, null until then.
    verified: typeof item.verified === "string",
  };
}

function routingRule(item: unknown): RoutingRule {
  if (!isRecord(item)) throw new Error("A routing rule isn't an object");
  const literal = list(item.matchers ?? [], "A routing rule's matchers").find(
    (matcher) =>
      isRecord(matcher) && matcher.type === "literal" && matcher.field === "to"
  );
  return {
    enabled: item.enabled === true,
    to:
      isRecord(literal) && typeof literal.value === "string"
        ? literal.value
        : null,
    actions: list(item.actions ?? [], "A routing rule's actions").map(
      (action) => {
        if (!isRecord(action)) {
          throw new Error("A routing rule's action isn't an object");
        }
        return {
          type: text(action.type, "A routing rule's action type"),
          value: list(action.value ?? [], "A routing rule's action value").map(
            (value) => text(value, "A routing rule's action value")
          ),
        };
      }
    ),
  };
}

/** The address wrangler.jsonc's SUBMISSION_EMAIL binding delivers to. */
export function submissionDestination(wranglerConfig: unknown): string {
  const bindings: unknown[] =
    isRecord(wranglerConfig) && Array.isArray(wranglerConfig.send_email)
      ? wranglerConfig.send_email
      : [];
  const binding = bindings.find(
    (item) => isRecord(item) && item.name === "SUBMISSION_EMAIL"
  );
  if (!isRecord(binding) || typeof binding.destination_address !== "string") {
    throw new Error(
      "wrangler.jsonc has no SUBMISSION_EMAIL binding with a destination_address"
    );
  }
  return binding.destination_address;
}

const sameAddress = (a: string, b: string) =>
  a.toLowerCase() === b.toLowerCase();

/** What's wrong with Email Routing, one line each; none when it's ready. */
function problems(
  env: EmailRoutingCheckEnv,
  addresses: readonly DestinationAddress[],
  rules: readonly RoutingRule[]
): string[] {
  const found: string[] = [];
  const address = addresses.find((item) =>
    sameAddress(item.email, env.destination)
  );
  if (!address) {
    found.push(`${env.destination} isn't an Email Routing destination address`);
  } else if (!address.verified) {
    found.push(
      `${env.destination} is a destination address but isn't verified`
    );
  }

  const aliasRules = rules.filter(
    (rule) =>
      rule.enabled && rule.to !== null && sameAddress(rule.to, env.alias)
  );
  const actions = aliasRules.flatMap((rule) => rule.actions);
  const alone =
    actions.length > 0 &&
    actions.every(
      (action) =>
        action.type === "forward" &&
        action.value.every((to) => sameAddress(to, env.destination))
    );
  if (aliasRules.length === 0) {
    found.push(`${env.alias} has no enabled routing rule`);
  } else if (!alone) {
    const sends = actions.map((action) =>
      action.type === "forward"
        ? `forwards to ${action.value.join(", ")}`
        : `has a ${action.type} action`
    );
    found.push(
      `${env.alias} ${sends.join(", and ")}; it should forward to ${env.destination} alone`
    );
  }
  return found;
}

/** Exactly what the failure lines start with, for the nightly report. */
export const EMAIL_ROUTING_FAILURE = "Email Routing check failed";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

// Logs each problem as an `::error::` and returns the exit code: 1 when Email
// Routing isn't ready or Cloudflare couldn't be read, so Nightly fails and
// opens its issue.
export async function runEmailRoutingCheck(
  env: EmailRoutingCheckEnv
): Promise<number> {
  let found: string[];
  try {
    const addresses = (
      await readAll(env, `/accounts/${env.accountId}/email/routing/addresses`)
    ).map(destinationAddress);
    const rules = (
      await readAll(env, `/zones/${await zoneId(env)}/email/routing/rules`)
    ).map(routingRule);
    found = problems(env, addresses, rules);
  } catch (error: unknown) {
    found = [errorMessage(error)];
  }
  for (const problem of found) {
    env.log(`::error::${EMAIL_ROUTING_FAILURE}: ${problem}`);
  }
  if (found.length > 0) return 1;
  env.log(
    `::notice::Email Routing is ready: ${env.destination} is a verified destination, and ${env.alias} forwards to it alone`
  );
  return 0;
}
