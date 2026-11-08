import type { Fetch } from "./download";
import { runEmailRoutingCheck } from "./email-routing-check";

const ACCOUNT = "0123456789abcdef0123456789abcdef";
const ZONE_ID = "fedcba9876543210fedcba9876543210";
const TOKEN = "cf-read-token-not-real";
const GMAIL = "thejestersprivilegepodcast@gmail.com";
const ALIAS = "hello@jestersprivilegepodcast.com";
const API = "https://api.cloudflare.com/client/v4";
const ADDRESSES = `/accounts/${ACCOUNT}/email/routing/addresses`;
const RULES = `/zones/${ZONE_ID}/email/routing/rules`;

// wrangler.jsonc as it is written: comments and trailing commas.
const CONFIG = `{
  // Submit emails go only to the show's Gmail.
  "send_email": [
    { "name": "SUBMISSION_EMAIL", "destination_address": "${GMAIL}", },
  ],
}`;

type Address = { email: string; verified: string | null };
type Rule = {
  enabled: boolean;
  matchers: { type: string; field?: string; value?: string }[];
  actions: { type: string; value?: string[] }[];
};

const verified = (email: string): Address => ({
  email,
  verified: "2026-10-28T17:02:11.000Z",
});
const forward = (to: string, ...destinations: string[]): Rule => ({
  enabled: true,
  matchers: [{ type: "literal", field: "to", value: to }],
  actions: [{ type: "forward", value: destinations }],
});

function reply(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Forbidden",
    text: async () => JSON.stringify(body),
  };
}

// Cloudflare's API as the account stands, paging each list by 50 as the real
// API does. `answers` replaces what a path answers. Any other path is a bug in
// the check.
function cloudflare(
  addresses: Address[],
  rules: Rule[],
  answers: Record<string, () => ReturnType<typeof reply>> = {}
): Fetch {
  const lists: Record<string, unknown[]> = {
    "/zones": [{ id: ZONE_ID, name: "jestersprivilegepodcast.com" }],
    [ADDRESSES]: addresses,
    [RULES]: rules,
  };
  return async (url, init) => {
    const parsed = new URL(url);
    const path = parsed.pathname.replace("/client/v4", "");
    if (init?.headers?.Authorization !== `Bearer ${TOKEN}`) {
      return reply(403, { success: false, errors: [], messages: [] });
    }
    const answer = answers[path];
    if (answer) return answer();
    const list = lists[path];
    if (!list) throw new Error(`Unexpected fetch of ${url}`);
    if (path === "/zones") {
      expect(parsed.searchParams.get("name")).toBe(
        "jestersprivilegepodcast.com"
      );
    }
    const page = Number(parsed.searchParams.get("page") ?? "1");
    return reply(200, {
      success: true,
      errors: [],
      messages: [],
      result: list.slice((page - 1) * 50, page * 50),
    });
  };
}

async function check(fetch: Fetch, config = CONFIG) {
  const lines: string[] = [];
  const code = await runEmailRoutingCheck(config, {
    fetch,
    apiToken: TOKEN,
    accountId: ACCOUNT,
    alias: ALIAS,
    log: (line) => lines.push(line),
  });
  return { code, lines };
}

const failure = (problem: string) =>
  `::error::Email Routing check failed: ${problem}`;

describe("runEmailRoutingCheck", () => {
  it("passes when the Gmail is verified and hello@ forwards to it alone", async () => {
    expect(
      await check(cloudflare([verified(GMAIL)], [forward(ALIAS, GMAIL)]))
    ).toEqual({
      code: 0,
      lines: [
        `::notice::Email Routing is ready: ${GMAIL} is a verified destination, and ${ALIAS} forwards to it alone`,
      ],
    });
  });

  it("fails while the Gmail waits to be verified", async () => {
    const unverified = { email: GMAIL, verified: null };
    expect(
      await check(cloudflare([unverified], [forward(ALIAS, GMAIL)]))
    ).toEqual({
      code: 1,
      lines: [failure(`${GMAIL} is a destination address but isn't verified`)],
    });
  });

  it("fails when the Gmail isn't a destination address at all", async () => {
    expect(
      await check(
        cloudflare([verified("someone@example.com")], [forward(ALIAS, GMAIL)])
      )
    ).toEqual({
      code: 1,
      lines: [failure(`${GMAIL} isn't an Email Routing destination address`)],
    });
  });

  it("reads every page of destination addresses", async () => {
    const others = Array.from({ length: 50 }, (_, i) =>
      verified(`listener${i}@example.com`)
    );
    const fetch = cloudflare(
      [...others, verified(GMAIL)],
      [forward(ALIAS, GMAIL)]
    );
    expect((await check(fetch)).code).toBe(0);
  });

  it("matches addresses whatever their case", async () => {
    const fetch = cloudflare(
      [verified(GMAIL.toUpperCase())],
      [forward("Hello@JestersPrivilegePodcast.com", GMAIL)]
    );
    expect((await check(fetch)).code).toBe(0);
  });

  it("fails when hello@ has only a disabled rule", async () => {
    const disabled = { ...forward(ALIAS, GMAIL), enabled: false };
    expect(await check(cloudflare([verified(GMAIL)], [disabled]))).toEqual({
      code: 1,
      lines: [failure(`${ALIAS} has no enabled routing rule`)],
    });
  });

  it("ignores the catch-all and other addresses' rules", async () => {
    const catchAll: Rule = {
      enabled: true,
      matchers: [{ type: "all" }],
      actions: [{ type: "drop", value: [] }],
    };
    const fetch = cloudflare(
      [verified(GMAIL)],
      [
        catchAll,
        forward("press@jestersprivilegepodcast.com", "a@example.com"),
        forward(ALIAS, GMAIL),
      ]
    );
    expect((await check(fetch)).code).toBe(0);
  });

  it("fails when hello@ forwards to another inbox too", async () => {
    const fetch = cloudflare(
      [verified(GMAIL)],
      [forward(ALIAS, GMAIL), forward(ALIAS, "michael@example.com")]
    );
    expect(await check(fetch)).toEqual({
      code: 1,
      lines: [
        failure(
          `${ALIAS} forwards to ${GMAIL}, and forwards to michael@example.com; it should forward to ${GMAIL} alone`
        ),
      ],
    });
  });

  it("fails when hello@ goes to a Worker instead", async () => {
    const toWorker: Rule = {
      ...forward(ALIAS),
      actions: [{ type: "worker", value: ["inbox"] }],
    };
    expect(await check(cloudflare([verified(GMAIL)], [toWorker]))).toEqual({
      code: 1,
      lines: [
        failure(
          `${ALIAS} has a worker action; it should forward to ${GMAIL} alone`
        ),
      ],
    });
  });

  it("fails when hello@ forwards to nobody", async () => {
    expect(
      await check(cloudflare([verified(GMAIL)], [forward(ALIAS)]))
    ).toEqual({
      code: 1,
      lines: [
        failure(
          `${ALIAS} forwards to nobody; it should forward to ${GMAIL} alone`
        ),
      ],
    });
  });

  it("fails when hello@'s rule has no actions", async () => {
    const empty: Rule = { ...forward(ALIAS), actions: [] };
    expect(await check(cloudflare([verified(GMAIL)], [empty]))).toEqual({
      code: 1,
      lines: [
        failure(`${ALIAS} has no actions; it should forward to ${GMAIL} alone`),
      ],
    });
  });

  it("names both problems when both prerequisites are missing", async () => {
    expect((await check(cloudflare([], []))).lines).toEqual([
      failure(`${GMAIL} isn't an Email Routing destination address`),
      failure(`${ALIAS} has no enabled routing rule`),
    ]);
  });

  it("names the permission a refused token lacks", async () => {
    const refused = () =>
      reply(403, {
        success: false,
        errors: [{ code: 10000, message: "Authentication error" }],
        messages: [],
      });
    const fetch = cloudflare([verified(GMAIL)], [forward(ALIAS, GMAIL)], {
      [RULES]: refused,
    });
    expect(await check(fetch)).toEqual({
      code: 1,
      lines: [
        failure(
          `Email Routing rules ${API}${RULES}?page=1&per_page=50 answered 403 Forbidden: 10000 Authentication error. CLOUDFLARE_READ_TOKEN needs Zone › Email Routing Rules: Read (docs/deploy.md, Account prerequisites).`
        ),
      ],
    });
  });

  it("fails when the token can't see the zone", async () => {
    const noZones = () =>
      reply(200, { success: true, errors: [], messages: [], result: [] });
    const fetch = cloudflare([verified(GMAIL)], [forward(ALIAS, GMAIL)], {
      "/zones": noZones,
    });
    expect(await check(fetch)).toEqual({
      code: 1,
      lines: [
        failure(
          "The token can't see the zone jestersprivilegepodcast.com, so it lacks Zone › Zone: Read"
        ),
      ],
    });
  });

  it("fails when Cloudflare's answer isn't the shape it documents", async () => {
    const notAList = () =>
      reply(200, { success: true, errors: [], messages: [], result: {} });
    const fetch = cloudflare([verified(GMAIL)], [forward(ALIAS, GMAIL)], {
      [RULES]: notAList,
    });
    expect(await check(fetch)).toEqual({
      code: 1,
      lines: [
        failure(
          `Email Routing rules ${API}${RULES}?page=1&per_page=50 has no result list`
        ),
      ],
    });
  });

  it("fails when Cloudflare can't be reached", async () => {
    const unreachable: Fetch = async () => {
      throw new Error("fetch failed");
    };
    expect(await check(unreachable)).toEqual({
      code: 1,
      lines: [
        failure(
          `Email Routing addresses ${API}${ADDRESSES}?page=1&per_page=50 couldn't be reached: fetch failed`
        ),
      ],
    });
  });

  it("fails when wrangler.jsonc has no send_email destination", async () => {
    const fetch = cloudflare([verified(GMAIL)], [forward(ALIAS, GMAIL)]);
    expect(await check(fetch, "{}")).toEqual({
      code: 1,
      lines: [
        failure(
          "wrangler.jsonc has no send_email binding with a destination_address"
        ),
      ],
    });
  });

  it("never logs the token, passing or failing", async () => {
    const runs = await Promise.all([
      check(cloudflare([verified(GMAIL)], [forward(ALIAS, GMAIL)])),
      check(cloudflare([], [])),
      check(
        cloudflare([], [], {
          [ADDRESSES]: () => reply(403, { success: false, errors: [] }),
        })
      ),
    ]);
    const lines = runs.flatMap((run) => run.lines);
    expect(lines).toHaveLength(4);
    expect(lines.filter((line) => line.includes(TOKEN))).toEqual([]);
  });
});
