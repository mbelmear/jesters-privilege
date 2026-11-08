import type { Fetch } from "./download";
import { runEmailDestinationCheck } from "./email-destination";

const ACCOUNT = "0123456789abcdef0123456789abcdef";
const TOKEN = "cf-token-not-real";
const INBOX = "thejestersprivilegepodcast@gmail.com";
const ADDRESSES = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/email/routing/addresses`;

// wrangler.jsonc as it is written: comments and trailing commas.
const CONFIG = `// Cloudflare Workers config.
{
  "name": "jesters-privilege",
  // Submit emails go only to the show's Gmail.
  "send_email": [
    {
      "name": "SUBMISSION_EMAIL",
      "destination_address": "${INBOX}",
    },
  ],
}
`;

type Address = { email: string; verified: string | null };

// A Cloudflare API whose destination addresses are `addresses`, answered in
// pages of `perPage` as the real API pages them.
function cloudflare(addresses: Address[], perPage = 50): Fetch {
  return async (url, init) => {
    const parsed = new URL(url);
    if (parsed.origin + parsed.pathname !== ADDRESSES) {
      throw new Error(`Unexpected fetch of ${url}`);
    }
    if (init?.headers?.Authorization !== `Bearer ${TOKEN}`) {
      return reply(403, { success: false, errors: [], messages: [] });
    }
    const page = Number(parsed.searchParams.get("page") ?? "1");
    const result = addresses
      .slice((page - 1) * perPage, page * perPage)
      .map((address, i) => ({
        id: `id${page}-${i}`,
        tag: `id${page}-${i}`,
        created: "2026-10-20T10:00:00Z",
        modified: "2026-10-20T10:00:00Z",
        ...address,
      }));
    return reply(200, {
      success: true,
      errors: [],
      messages: [],
      result,
      result_info: {
        page,
        per_page: perPage,
        count: result.length,
        total_count: addresses.length,
        total_pages: Math.max(1, Math.ceil(addresses.length / perPage)),
      },
    });
  };
}

function reply(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Forbidden",
    text: async () => JSON.stringify(body),
  };
}

// Runs the check and collects what it logs.
async function run(fetch: Fetch, config = CONFIG) {
  const lines: string[] = [];
  const code = await runEmailDestinationCheck(config, {
    fetch,
    accountId: ACCOUNT,
    apiToken: TOKEN,
    log: (line) => lines.push(line),
  });
  return { code, lines };
}

const VERIFIED = { email: INBOX, verified: "2026-11-03T15:12:00Z" };

describe("runEmailDestinationCheck", () => {
  it("passes when the send_email destination is a verified destination address", async () => {
    const { code, lines } = await run(cloudflare([VERIFIED]));
    expect(code).toBe(0);
    expect(lines).toEqual([
      `::notice::${INBOX} is a verified Email Routing destination`,
    ]);
  });

  it("finds the destination on a later page of the API's list", async () => {
    const others = Array.from({ length: 50 }, (_, i) => ({
      email: `listener${i}@example.com`,
      verified: "2026-10-20T10:00:00Z",
    }));
    const { code } = await run(cloudflare([...others, VERIFIED]));
    expect(code).toBe(0);
  });

  it("fails, naming the address and where to add it, when it isn't a destination address", async () => {
    const { code, lines } = await run(
      cloudflare([
        { email: "someone-else@example.com", verified: "2026-11-03T15:12:00Z" },
      ])
    );
    expect(code).toBe(1);
    expect(lines).toEqual([
      `::error::${INBOX} isn't an Email Routing destination address, so every Submission would fail with the delivery error. Add and verify it in the Cloudflare dashboard under Compute › Email Service › Email Routing › Destination Addresses.`,
    ]);
  });

  it("fails when the destination address is still waiting to be verified", async () => {
    const { code, lines } = await run(
      cloudflare([{ email: INBOX, verified: null }])
    );
    expect(code).toBe(1);
    expect(lines).toEqual([
      `::error::${INBOX} is an Email Routing destination address that isn't verified yet, so every Submission would fail with the delivery error. Follow the link in the verification email Cloudflare sent it; the Cloudflare dashboard shows its status under Compute › Email Service › Email Routing › Destination Addresses.`,
    ]);
  });

  describe("fails when wrangler.jsonc names no destination to check", () => {
    it("when it has no send_email binding", async () => {
      const { code, lines } = await run(
        cloudflare([VERIFIED]),
        `{ "name": "jesters-privilege" }`
      );
      expect(code).toBe(1);
      expect(lines).toEqual([
        "::error::Email Routing check failed, so nothing deploys: wrangler.jsonc has no send_email binding with a destination_address",
      ]);
    });

    it("when a send_email binding has no destination_address", async () => {
      const { code, lines } = await run(
        cloudflare([VERIFIED]),
        `{ "send_email": [{ "name": "SUBMISSION_EMAIL" }] }`
      );
      expect(code).toBe(1);
      expect(lines).toEqual([
        "::error::Email Routing check failed, so nothing deploys: wrangler.jsonc's send_email binding SUBMISSION_EMAIL has no destination_address",
      ]);
    });

    it("when it can't be read", async () => {
      const { code, lines } = await run(cloudflare([VERIFIED]), `{ "name": `);
      expect(code).toBe(1);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(
        /^::error::Email Routing check failed, so nothing deploys: wrangler\.jsonc isn't JSONC: /
      );
    });
  });

  describe("fails, without deploying, when the API can't say", () => {
    const API_ERROR = `::error::Email Routing check failed, so nothing deploys: Email Routing addresses ${ADDRESSES}?page=1&per_page=50`;

    it("names the token permission when the API refuses the token", async () => {
      const refusing: Fetch = async () =>
        reply(403, {
          success: false,
          errors: [{ code: 10000, message: "Authentication error" }],
          messages: [],
        });
      const { code, lines } = await run(refusing);
      expect(code).toBe(1);
      expect(lines).toEqual([
        `${API_ERROR} answered 403 Forbidden: 10000 Authentication error. CLOUDFLARE_API_TOKEN needs Account › Email Routing Addresses: Read (docs/deploy.md, Account prerequisites).`,
      ]);
      expect(lines.join("\n")).not.toContain(TOKEN);
    });

    // What the API answered a malformed token on 2026-11-08.
    it("names the token permission when the API can't authenticate the token", async () => {
      const unauthenticated: Fetch = async () => ({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () =>
          '{"success":false,"errors":[{"code":9106,"message":"Authentication failed (status: 400)"}],"messages":[],"result":null}',
      });
      const { code, lines } = await run(unauthenticated);
      expect(code).toBe(1);
      expect(lines).toEqual([
        `${API_ERROR} answered 400 Bad Request: 9106 Authentication failed (status: 400). CLOUDFLARE_API_TOKEN needs Account › Email Routing Addresses: Read (docs/deploy.md, Account prerequisites).`,
      ]);
    });

    it("when the API answers an error that isn't the token's", async () => {
      const down: Fetch = async () => ({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
        text: async () => "<html>Bad gateway</html>",
      });
      const { code, lines } = await run(down);
      expect(code).toBe(1);
      expect(lines).toEqual([
        `${API_ERROR} answered 502 Bad Gateway: no errors given`,
      ]);
    });

    it("when the API can't be reached", async () => {
      const unreachable: Fetch = async () => {
        throw new Error("getaddrinfo ENOTFOUND api.cloudflare.com");
      };
      const { code, lines } = await run(unreachable);
      expect(code).toBe(1);
      expect(lines).toEqual([
        `${API_ERROR} couldn't be reached: getaddrinfo ENOTFOUND api.cloudflare.com`,
      ]);
    });

    it("when the API answers without success, naming its errors", async () => {
      const failing: Fetch = async () =>
        reply(200, {
          success: false,
          errors: [{ code: 7003, message: "Could not route to /accounts" }],
          messages: [],
        });
      const { code, lines } = await run(failing);
      expect(code).toBe(1);
      expect(lines).toEqual([
        `${API_ERROR} reported failure: 7003 Could not route to /accounts`,
      ]);
    });

    it("when the API's pages never end", async () => {
      const full = Array.from({ length: 50 }, (_, i) => ({
        email: `listener${i}@example.com`,
        verified: "2026-10-20T10:00:00Z",
      }));
      // An API that ignores `page` answers every request with the first.
      const first = cloudflare(full);
      const endless: Fetch = (url, init) =>
        first(url.replace(/page=\d+/, "page=1"), init);
      const { code, lines } = await run(endless);
      expect(code).toBe(1);
      expect(lines).toEqual([
        "::error::Email Routing check failed, so nothing deploys: Email Routing addresses listed more than 20 pages of 50, so the API's paging can't be trusted",
      ]);
    });

    it("when the API's answer isn't a list of addresses", async () => {
      const garbled: Fetch = async () => ({
        ...reply(200, {}),
        text: async () => "<html>Bad gateway</html>",
      });
      const { code, lines } = await run(garbled);
      expect(code).toBe(1);
      expect(lines).toEqual([`${API_ERROR} isn't JSON`]);
    });
  });
});
