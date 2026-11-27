/**
 * @jest-environment node
 */
import worker from "@/worker/index";
import { fakeFetch, madeUpResponse, recordedResponse } from "../../fake-fetch";

const assets = {
  fetch: async (request: Request) => new Response(`asset ${request.url}`),
};

function fakeEnv() {
  const sent: unknown[] = [];
  const env = {
    ASSETS: assets,
    TURNSTILE_SECRET_KEY: "turnstile-secret",
    DEPLOY_DISPATCH_TOKEN: "dispatch-token",
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
      // Made up in the format Cloudflare's Siteverify docs give.
      const siteverify = fakeFetch(() => madeUpResponse({ success: true }));
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
          to: "thejestersprivilegepodcast@gmail.com",
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
      // Made up in the format Cloudflare's Siteverify docs give.
      fakeFetch(() =>
        madeUpResponse({
          success: false,
          "error-codes": ["invalid-input-response"],
        })
      );
      const { env, sent } = fakeEnv();

      const response = await worker.fetch(submitRequest(), env);

      expect(response.status).toBe(403);
      expect(sent).toEqual([]);
    });

    // Made up: Siteverify's error codes as its docs give them, and answers
    // only the Worker's handling of a failure reads.
    it.each([
      ["answers with an error", madeUpResponse("down", { status: 500 })],
      [
        "refuses the site's secret",
        madeUpResponse({
          success: false,
          "error-codes": ["invalid-input-secret"],
        }),
      ],
      ["answers with something other than a verdict", madeUpResponse({})],
    ])("sends nothing when Turnstile %s", async (_case, answer) => {
      fakeFetch(() => answer);
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

  describe("the hourly Cron Trigger", () => {
    afterEach(() => jest.restoreAllMocks());

    const DISPATCHES =
      "https://api.github.com/repos/mbelmear/jesters-privilege/actions/workflows/deploy.yml/dispatches";

    it("starts Deploy on main with the feed check turned on", async () => {
      // Made up in the format GitHub's REST docs give for a dispatch that
      // returns the run's details (read 2026-11-26); only the log line reads
      // it. Its 200 isn't pinned: the Worker takes any 2xx as started.
      const github = fakeFetch(() =>
        madeUpResponse({
          workflow_run_id: 101,
          run_url:
            "https://api.github.com/repos/mbelmear/jesters-privilege/actions/runs/101",
          html_url:
            "https://github.com/mbelmear/jesters-privilege/actions/runs/101",
        })
      );
      const logged = jest.spyOn(console, "log").mockImplementation(() => {});

      await worker.scheduled({}, fakeEnv().env);

      const [url, init] = github.mock.calls[0];
      expect(url).toBe(DISPATCHES);
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer dispatch-token");
      // GitHub's REST API refuses a request without one.
      expect(headers.get("User-Agent")).toBeTruthy();
      expect(JSON.parse(String(init?.body))).toEqual({
        ref: "main",
        inputs: { "feed-check": "true" },
        return_run_details: true,
      });
      expect(logged).toHaveBeenCalledWith(
        "Started a feed check: https://github.com/mbelmear/jesters-privilege/actions/runs/101"
      );
    });

    it("fails, naming GitHub's answer, when GitHub refuses the token", async () => {
      // Recorded 2026-11-26: GitHub's answer to a POST to DISPATCHES with a
      // token that isn't one.
      fakeFetch(() =>
        recordedResponse(
          "2026-11-26",
          {
            message: "Bad credentials",
            documentation_url: "https://docs.github.com/rest",
            status: "401",
          },
          { status: 401 }
        )
      );

      const error = await worker.scheduled({}, fakeEnv().env).then(
        () => null,
        (thrown: unknown) => thrown
      );

      expect(error).toEqual(
        new Error(
          "GitHub refused to start the feed check (401): Bad credentials"
        )
      );
    });

    it("fails without asking GitHub when the Worker has no token", async () => {
      const github = fakeFetch(() => {
        throw new Error("The Worker asked GitHub without a token");
      });
      const { env } = fakeEnv();

      await expect(
        worker.scheduled({}, { ...env, DEPLOY_DISPATCH_TOKEN: undefined })
      ).rejects.toThrow(
        "DEPLOY_DISPATCH_TOKEN isn't set, so no feed check was started (docs/deploy.md, Credentials)"
      );
      expect(github).not.toHaveBeenCalled();
    });
  });
});
