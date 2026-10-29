/**
 * @jest-environment node
 */
import worker from "./index";

const assets = {
  fetch: async (request: Request) => new Response(`asset ${request.url}`),
};

function fakeEnv() {
  const sent: unknown[] = [];
  const env = {
    ASSETS: assets,
    TURNSTILE_SECRET_KEY: "turnstile-secret",
    SUBMISSION_EMAIL: {
      send: async (message: unknown) => {
        sent.push(message);
        return { messageId: "m-1" };
      },
    },
  };
  return { env, sent };
}

function submitRequest(): Request {
  return new Request("https://jestersprivilegepodcast.com/api/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": "203.0.113.7",
    },
    body: JSON.stringify({
      type: "confession",
      message: "I laughed at a sermon on purpose.",
      name: "",
      email: "",
      consent: true,
      website: "",
      turnstileToken: "token-from-widget",
    }),
  });
}

describe("Worker", () => {
  it("redirects www to the apex domain, keeping the path and query", async () => {
    const response = await worker.fetch(
      new Request("https://www.jestersprivilegepodcast.com/episodes/1?t=90"),
      fakeEnv().env
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe(
      "https://jestersprivilegepodcast.com/episodes/1?t=90"
    );
  });

  it("serves the site's files for the apex domain", async () => {
    const response = await worker.fetch(
      new Request("https://jestersprivilegepodcast.com/about"),
      fakeEnv().env
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(
      "asset https://jestersprivilegepodcast.com/about"
    );
  });

  it("serves the site's files on a preview URL", async () => {
    const response = await worker.fetch(
      new Request("https://pr-8-jesters-privilege.example.workers.dev/"),
      fakeEnv().env
    );

    expect(await response.text()).toBe(
      "asset https://pr-8-jesters-privilege.example.workers.dev/"
    );
  });

  describe("POST /api/submit", () => {
    afterEach(() => jest.restoreAllMocks());

    it("checks the token with Turnstile, then emails the show", async () => {
      const siteverify = jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(Response.json({ success: true }));
      const { env, sent } = fakeEnv();

      const response = await worker.fetch(submitRequest(), env);

      expect(await response.json()).toEqual({ ok: true });
      const [url, init] = siteverify.mock.calls[0];
      expect(url).toBe(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify"
      );
      expect(init?.method).toBe("POST");
      expect(
        Object.fromEntries(new URLSearchParams(String(init?.body)))
      ).toEqual({
        secret: "turnstile-secret",
        response: "token-from-widget",
        remoteip: "203.0.113.7",
      });
      expect(sent).toEqual([
        {
          from: {
            email: "submit@jestersprivilegepodcast.com",
            name: "Jester's Privilege site",
          },
          to: "hello@jestersprivilegepodcast.com",
          subject: "Confession from Anonymous",
          text: [
            "Type: Confession",
            "Name: Anonymous",
            "Email: None given",
            "Consent: Yes, this may be mentioned on the show",
            "",
            "I laughed at a sermon on purpose.",
          ].join("\n"),
        },
      ]);
    });

    it("sends nothing when Turnstile says the token is bad", async () => {
      jest.spyOn(globalThis, "fetch").mockResolvedValue(
        Response.json({
          success: false,
          "error-codes": ["invalid-input-response"],
        })
      );
      const { env, sent } = fakeEnv();

      const response = await worker.fetch(submitRequest(), env);

      expect(response.status).toBe(403);
      expect(sent).toEqual([]);
    });

    it.each([
      ["answers with an error", () => new Response("down", { status: 500 })],
      [
        "refuses the site's secret",
        () =>
          Response.json({
            success: false,
            "error-codes": ["invalid-input-secret"],
          }),
      ],
      ["answers with something other than a verdict", () => Response.json({})],
    ])("sends nothing when Turnstile %s", async (_case, answer) => {
      jest.spyOn(globalThis, "fetch").mockResolvedValue(answer());
      jest.spyOn(console, "error").mockImplementation(() => {});
      const { env, sent } = fakeEnv();

      const response = await worker.fetch(submitRequest(), env);

      expect(response.status).toBe(502);
      expect(sent).toEqual([]);
    });

    it("turns away other methods", async () => {
      const response = await worker.fetch(
        new Request("https://jestersprivilegepodcast.com/api/submit"),
        fakeEnv().env
      );

      expect(response.status).toBe(405);
      expect(response.headers.get("Allow")).toBe("POST");
    });
  });
});
