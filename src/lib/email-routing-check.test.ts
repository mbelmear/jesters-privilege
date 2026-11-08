import {
  runEmailRoutingCheck,
  submissionDestination,
  type CloudflareAnswer,
  type EmailRoutingCheckEnv,
} from "./email-routing-check";

const ACCOUNT = "0123456789abcdef0123456789abcdef";
const ZONE_ID = "fedcba9876543210fedcba9876543210";
const GMAIL = "thejestersprivilegepodcast@gmail.com";
const ALIAS = "hello@jestersprivilegepodcast.com";

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

const ok = (result: unknown, totalPages = 1): CloudflareAnswer => ({
  status: 200,
  body: {
    success: true,
    errors: [],
    result,
    result_info: { page: 1, total_pages: totalPages },
  },
});

// Cloudflare's API as the account stands: one page of each list unless a test
// splits them. Any other path is a bug in the check.
function cloudflare(
  addresses: Address[],
  rules: Rule[],
  answers: Record<string, CloudflareAnswer> = {}
): EmailRoutingCheckEnv["get"] {
  const pages: Record<string, CloudflareAnswer> = {
    [`/zones?name=jestersprivilegepodcast.com`]: ok([
      { id: ZONE_ID, name: "jestersprivilegepodcast.com" },
    ]),
    [`/accounts/${ACCOUNT}/email/routing/addresses?page=1&per_page=50`]:
      ok(addresses),
    [`/zones/${ZONE_ID}/email/routing/rules?page=1&per_page=50`]: ok(rules),
    ...answers,
  };
  return async (path) => {
    const answer = pages[path];
    if (!answer) throw new Error(`Unexpected request for ${path}`);
    return answer;
  };
}

async function check(get: EmailRoutingCheckEnv["get"]) {
  const lines: string[] = [];
  const code = await runEmailRoutingCheck({
    accountId: ACCOUNT,
    zone: "jestersprivilegepodcast.com",
    alias: ALIAS,
    destination: GMAIL,
    get,
    log: (line) => lines.push(line),
  });
  return { code, lines };
}

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

  const failure = (problem: string) =>
    `::error::Email Routing check failed: ${problem}`;

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
    const page = (n: number) =>
      `/accounts/${ACCOUNT}/email/routing/addresses?page=${n}&per_page=50`;
    const get = cloudflare([], [forward(ALIAS, GMAIL)], {
      [page(1)]: ok([verified("someone@example.com")], 2),
      [page(2)]: ok([verified(GMAIL)], 2),
    });
    expect((await check(get)).code).toBe(0);
  });

  it("matches addresses whatever their case", async () => {
    expect(
      (
        await check(
          cloudflare(
            [verified(GMAIL.toUpperCase())],
            [forward("Hello@JestersPrivilegePodcast.com", GMAIL)]
          )
        )
      ).code
    ).toBe(0);
  });

  it("fails when hello@ has only a disabled rule", async () => {
    expect(
      await check(
        cloudflare(
          [verified(GMAIL)],
          [{ ...forward(ALIAS, GMAIL), enabled: false }]
        )
      )
    ).toEqual({
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
    expect(
      (
        await check(
          cloudflare(
            [verified(GMAIL)],
            [
              catchAll,
              forward("press@jestersprivilegepodcast.com", "a@example.com"),
              forward(ALIAS, GMAIL),
            ]
          )
        )
      ).code
    ).toBe(0);
  });

  it("fails when hello@ forwards to another inbox too", async () => {
    expect(
      await check(
        cloudflare(
          [verified(GMAIL)],
          [forward(ALIAS, GMAIL), forward(ALIAS, "michael@example.com")]
        )
      )
    ).toEqual({
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

  it("names both problems when both prerequisites are missing", async () => {
    expect((await check(cloudflare([], []))).lines).toEqual([
      failure(`${GMAIL} isn't an Email Routing destination address`),
      failure(`${ALIAS} has no enabled routing rule`),
    ]);
  });

  it("fails with Cloudflare's reason when the token is refused", async () => {
    const path = `/accounts/${ACCOUNT}/email/routing/addresses?page=1&per_page=50`;
    const get = cloudflare([verified(GMAIL)], [forward(ALIAS, GMAIL)], {
      [path]: {
        status: 403,
        body: {
          success: false,
          errors: [{ code: 10000, message: "Authentication error" }],
          result: null,
        },
      },
    });
    expect(await check(get)).toEqual({
      code: 1,
      lines: [
        failure(`Cloudflare answered ${path} with 403: Authentication error`),
      ],
    });
  });

  it("fails when the token can't see the zone", async () => {
    const get = cloudflare([verified(GMAIL)], [forward(ALIAS, GMAIL)], {
      ["/zones?name=jestersprivilegepodcast.com"]: ok([]),
    });
    expect(await check(get)).toEqual({
      code: 1,
      lines: [
        failure("The token can't see the zone jestersprivilegepodcast.com"),
      ],
    });
  });

  it("fails when Cloudflare's answer isn't the shape it documents", async () => {
    const get = cloudflare([verified(GMAIL)], [forward(ALIAS, GMAIL)], {
      [`/zones/${ZONE_ID}/email/routing/rules?page=1&per_page=50`]: ok({}),
    });
    expect(await check(get)).toEqual({
      code: 1,
      lines: [
        failure(
          `Cloudflare's answer to /zones/${ZONE_ID}/email/routing/rules?page=1&per_page=50 isn't a list`
        ),
      ],
    });
  });

  it("fails when Cloudflare can't be reached", async () => {
    const get = async () => {
      throw new Error("fetch failed");
    };
    expect(await check(get)).toEqual({
      code: 1,
      lines: [failure("fetch failed")],
    });
  });
});

describe("submissionDestination", () => {
  it("is the address wrangler.jsonc's SUBMISSION_EMAIL binding delivers to", () => {
    expect(
      submissionDestination({
        send_email: [
          { name: "OTHER", destination_address: "a@example.com" },
          { name: "SUBMISSION_EMAIL", destination_address: GMAIL },
        ],
      })
    ).toBe(GMAIL);
  });

  it("fails when the binding has no destination", () => {
    expect(() =>
      submissionDestination({ send_email: [{ name: "SUBMISSION_EMAIL" }] })
    ).toThrow(
      "wrangler.jsonc has no SUBMISSION_EMAIL binding with a destination_address"
    );
    expect(() => submissionDestination({})).toThrow(
      "wrangler.jsonc has no SUBMISSION_EMAIL binding with a destination_address"
    );
  });
});
