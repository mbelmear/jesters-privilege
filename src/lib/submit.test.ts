/**
 * @jest-environment node
 */
import { handleSubmit, type Email, type SubmitDeps } from "./submit";

const validBody = {
  type: "question",
  message: "Do court jesters get dental?",
  name: "Brother Tuck",
  email: "tuck@example.com",
  consent: true,
  website: "",
  turnstileToken: "token-from-widget",
};

function submitRequest(body: unknown): Request {
  return new Request("https://jestersprivilegepodcast.com/api/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": "203.0.113.7",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function fakeDeps(overrides: Partial<SubmitDeps> = {}) {
  const sent: Email[] = [];
  const verified: { token: string; ip: string | null }[] = [];
  const deps: SubmitDeps = {
    verifyTurnstile: async (token, ip) => {
      verified.push({ token, ip });
      return true;
    },
    sendEmail: async (email) => {
      sent.push(email);
    },
    ...overrides,
  };
  return { deps, sent, verified };
}

describe("handleSubmit", () => {
  it("emails a valid Submission to the show and reports success", async () => {
    const { deps, sent } = fakeDeps();

    const response = await handleSubmit(submitRequest(validBody), deps);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
  });

  it("writes the type, name, email, consent, and message into the email", async () => {
    const { deps, sent } = fakeDeps();

    await handleSubmit(submitRequest(validBody), deps);

    expect(sent).toEqual([
      {
        subject: "Question from Brother Tuck",
        text: [
          "Type: Question",
          "Name: Brother Tuck",
          "Email: tuck@example.com",
          "Consent: Yes, this may be mentioned on the show",
          "",
          "Do court jesters get dental?",
        ].join("\n"),
      },
    ]);
  });

  it("calls a Submission with no name Anonymous and notes a missing email", async () => {
    const { deps, sent } = fakeDeps();

    await handleSubmit(
      submitRequest({
        ...validBody,
        type: "topic-idea",
        name: "  ",
        email: "",
        message: "Do an episode on Tarlton.",
      }),
      deps
    );

    expect(sent).toEqual([
      {
        subject: "Topic idea from Anonymous",
        text: [
          "Type: Topic idea",
          "Name: Anonymous",
          "Email: None given",
          "Consent: Yes, this may be mentioned on the show",
          "",
          "Do an episode on Tarlton.",
        ].join("\n"),
      },
    ]);
  });

  it.each([
    ["type", "an unlisted type", { type: "complaint" }],
    ["type", "a missing type", { type: undefined }],
    ["message", "a missing message", { message: undefined }],
    ["message", "a blank message", { message: " \n " }],
    [
      "message",
      "a message over 5000 characters",
      { message: "a".repeat(5001) },
    ],
    ["name", "a name over 100 characters", { name: "a".repeat(101) }],
    ["name", "a name that isn't text", { name: 42 }],
    ["name", "a name spanning lines", { name: "Tuck\nBcc: x@example.com" }],
    ["email", "an email with no @", { email: "tuck.example.com" }],
    ["email", "an email with no domain dot", { email: "tuck@example" }],
    ["email", "an email with spaces", { email: "tuck @example.com" }],
    [
      "email",
      "an email over 254 characters",
      { email: `${"a".repeat(243)}@example.com` },
    ],
    ["consent", "consent left unchecked", { consent: false }],
    ["consent", "consent missing", { consent: undefined }],
    ["consent", "consent sent as text", { consent: "true" }],
  ])("rejects %s: %s", async (field, _rule, change) => {
    const { deps, sent, verified } = fakeDeps();

    const response = await handleSubmit(
      submitRequest({ ...validBody, ...change }),
      deps
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error: "invalid",
      field,
    });
    expect(verified).toEqual([]);
    expect(sent).toEqual([]);
  });

  it("accepts a message of exactly 5000 characters", async () => {
    const { deps, sent } = fakeDeps();

    const response = await handleSubmit(
      submitRequest({ ...validBody, message: "a".repeat(5000) }),
      deps
    );

    expect(response.status).toBe(200);
    expect(sent).toHaveLength(1);
  });

  it.each([
    ["isn't JSON", "type=question&message=hi"],
    ["is a JSON array", "[]"],
    [
      "is over 32 KB",
      JSON.stringify({ ...validBody, padding: "a".repeat(32 * 1024) }),
    ],
  ])("rejects a body that %s", async (_rule, body) => {
    const { deps, sent } = fakeDeps();

    const response = await handleSubmit(submitRequest(body), deps);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: "invalid" });
    expect(sent).toEqual([]);
  });

  it("drops a honeypot hit silently: it looks sent, but nothing is", async () => {
    const { deps, sent, verified } = fakeDeps();

    const response = await handleSubmit(
      submitRequest({ ...validBody, website: "https://spam.example" }),
      deps
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(verified).toEqual([]);
    expect(sent).toEqual([]);
  });

  it("drops a honeypot hit even when the rest of the form is invalid", async () => {
    const { deps, sent } = fakeDeps();

    const response = await handleSubmit(
      submitRequest({ website: "spam", consent: false }),
      deps
    );

    expect(await response.json()).toEqual({ ok: true });
    expect(sent).toEqual([]);
  });

  it("verifies the Turnstile token with the listener's IP before sending", async () => {
    const { deps, verified } = fakeDeps();

    await handleSubmit(submitRequest(validBody), deps);

    expect(verified).toEqual([
      { token: "token-from-widget", ip: "203.0.113.7" },
    ]);
  });

  it("sends nothing when Turnstile rejects the token", async () => {
    const { deps, sent } = fakeDeps({ verifyTurnstile: async () => false });

    const response = await handleSubmit(submitRequest(validBody), deps);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      ok: false,
      error: "verification",
    });
    expect(sent).toEqual([]);
  });

  it.each([
    ["missing", undefined],
    ["blank", ""],
    ["not text", 7],
  ])(
    "refuses a Turnstile token that is %s without asking Turnstile",
    async (_rule, turnstileToken) => {
      const { deps, sent, verified } = fakeDeps();

      const response = await handleSubmit(
        submitRequest({ ...validBody, turnstileToken }),
        deps
      );

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        ok: false,
        error: "verification",
      });
      expect(verified).toEqual([]);
      expect(sent).toEqual([]);
    }
  );

  it("sends nothing when Turnstile can't be reached", async () => {
    const { deps, sent } = fakeDeps({
      verifyTurnstile: async () => {
        throw new Error("siteverify answered 500");
      },
    });
    const logged = jest.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleSubmit(submitRequest(validBody), deps);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      ok: false,
      error: "verification",
    });
    expect(sent).toEqual([]);
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it("reports a failure when the email can't be sent", async () => {
    const { deps } = fakeDeps({
      sendEmail: async () => {
        throw new Error("E_RECIPIENT_NOT_ALLOWED");
      },
    });
    const logged = jest.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleSubmit(submitRequest(validBody), deps);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ ok: false, error: "delivery" });
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});
