// Nightly's check of the Email Routing prerequisites (docs/deploy.md, Account
// prerequisites) that nothing else would notice until a visitor's Submission
// failed: wrangler.jsonc's send_email destination is still a verified
// destination between deploys, and hello@ forwards to it alone (#113, #159).
// It reads wrangler.jsonc and Cloudflare's lists with the deploy's check
// (src/lib/email-destination.ts); scripts/email-routing-check.ts wires in the
// network and the read-only token.
import { errorMessage, type Fetch } from "./download";
import {
  cloudflareList,
  destinationAddresses,
  destinationList,
  type CloudflareApi,
  type Destination,
} from "./email-destination";

export type EmailRoutingCheckEnv = {
  fetch: Fetch;
  // Sent only in the Authorization header; never logged.
  apiToken: string;
  accountId: string;
  // The public address, such as hello@; its domain is the zone.
  alias: string;
  // Workflow-command log lines (::notice::, ::error::).
  log: (line: string) => void;
};

// What a routing rule does with the mail it matches.
type RoutingAction = { type: string; value: string[] };
type RoutingRule = {
  enabled: boolean;
  // The address a literal `to` matcher names; null for any other rule.
  to: string | null;
  actions: RoutingAction[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function strings(value: unknown, source: string): string[] {
  const list: unknown[] = Array.isArray(value) ? value : [];
  if (!Array.isArray(value) || list.some((item) => typeof item !== "string")) {
    throw new Error(`${source} isn't a list of text`);
  }
  return list.map(String);
}

function routingRule(item: unknown, source: string): RoutingRule {
  if (!isRecord(item)) throw new Error(`${source} isn't an object`);
  if (typeof item.enabled !== "boolean") {
    throw new Error(`${source} has no enabled`);
  }
  const matchers: unknown[] = Array.isArray(item.matchers) ? item.matchers : [];
  const actions: unknown[] = Array.isArray(item.actions) ? item.actions : [];
  if (!Array.isArray(item.matchers) || !Array.isArray(item.actions)) {
    throw new Error(`${source} has no matchers or actions`);
  }
  const literal = matchers.find(
    (matcher) =>
      isRecord(matcher) && matcher.type === "literal" && matcher.field === "to"
  );
  return {
    enabled: item.enabled,
    to:
      isRecord(literal) && typeof literal.value === "string"
        ? literal.value
        : null,
    actions: actions.map((action, i) => {
      if (!isRecord(action) || typeof action.type !== "string") {
        throw new Error(`${source} action ${i} has no type`);
      }
      return {
        type: action.type,
        value: strings(action.value ?? [], `${source} action ${i}'s value`),
      };
    }),
  };
}

async function zoneId(api: CloudflareApi, zone: string): Promise<string> {
  const permission = "Zone › Zone: Read";
  const { items, source } = await cloudflareList(api, {
    what: "Zones",
    path: `/zones?name=${encodeURIComponent(zone)}`,
    permission,
  });
  const found = items.find((item) => isRecord(item) && item.name === zone);
  if (!isRecord(found)) {
    throw new Error(
      `The token can't see the zone ${zone}, so it lacks ${permission}`
    );
  }
  if (typeof found.id !== "string") throw new Error(`${source} has no id`);
  return found.id;
}

async function routingRules(
  api: CloudflareApi,
  zone: string
): Promise<RoutingRule[]> {
  const { items, source } = await cloudflareList(api, {
    what: "Email Routing rules",
    path: `/zones/${await zoneId(api, zone)}/email/routing/rules`,
    permission: "Zone › Email Routing Rules: Read",
  });
  return items.map((item, i) => routingRule(item, `${source} result ${i}`));
}

const sameAddress = (a: string, b: string) =>
  a.toLowerCase() === b.toLowerCase();

// What's wrong with the destinations: unlisted or not yet verified.
function destinationProblems(
  addresses: readonly string[],
  listed: readonly Destination[]
): string[] {
  return addresses.flatMap((address) => {
    const found = listed.find(({ email }) => sameAddress(email, address));
    if (!found)
      return [`${address} isn't an Email Routing destination address`];
    if (!found.verified) {
      return [`${address} is a destination address but isn't verified`];
    }
    return [];
  });
}

// What's wrong with the alias's rules: none enabled, or one that sends its
// mail anywhere but the destinations.
function aliasProblems(
  alias: string,
  addresses: readonly string[],
  rules: readonly RoutingRule[]
): string[] {
  const aliasRules = rules.filter(
    (rule) => rule.enabled && rule.to !== null && sameAddress(rule.to, alias)
  );
  if (aliasRules.length === 0) return [`${alias} has no enabled routing rule`];
  const actions = aliasRules.flatMap((rule) => rule.actions);
  const toDestinations = (action: RoutingAction) =>
    action.type === "forward" &&
    action.value.length > 0 &&
    action.value.every((to) =>
      addresses.some((address) => sameAddress(to, address))
    );
  if (actions.length > 0 && actions.every(toDestinations)) return [];
  const sends = actions.length
    ? actions.map((action) =>
        action.type === "forward"
          ? `forwards to ${action.value.join(", ") || "nobody"}`
          : `has a ${action.type} action`
      )
    : ["has no actions"];
  return [
    `${alias} ${sends.join(", and ")}; it should forward to ${addresses.join(", ")} alone`,
  ];
}

/** Exactly what the failure lines start with, for the nightly report. */
export const EMAIL_ROUTING_FAILURE = "Email Routing check failed";

// Logs each problem as an `::error::` and returns the exit code: 1 when Email
// Routing isn't ready, or wrangler.jsonc (`config`, its text) or Cloudflare
// couldn't be read, so Nightly fails and opens its issue.
export async function runEmailRoutingCheck(
  config: string,
  env: EmailRoutingCheckEnv
): Promise<number> {
  const api: CloudflareApi = {
    fetch: env.fetch,
    apiToken: env.apiToken,
    tokenName: "CLOUDFLARE_READ_TOKEN",
  };
  let addresses: string[];
  let problems: string[];
  try {
    addresses = destinationAddresses(config);
    const zone = env.alias.slice(env.alias.indexOf("@") + 1);
    problems = [
      ...destinationProblems(
        addresses,
        await destinationList(api, env.accountId)
      ),
      ...aliasProblems(env.alias, addresses, await routingRules(api, zone)),
    ];
  } catch (error: unknown) {
    env.log(`::error::${EMAIL_ROUTING_FAILURE}: ${errorMessage(error)}`);
    return 1;
  }
  for (const problem of problems) {
    env.log(`::error::${EMAIL_ROUTING_FAILURE}: ${problem}`);
  }
  if (problems.length > 0) return 1;
  env.log(
    `::notice::Email Routing is ready: ${addresses.join(", ")} is a verified destination, and ${env.alias} forwards to it alone`
  );
  return 0;
}
