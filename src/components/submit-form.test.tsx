import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { renderToString } from "react-dom/server";
import { content } from "@/content";
import { SubmitForm } from "./submit-form";
import { fakeTurnstile } from "@/lib/fake-turnstile";

const copy = content.speakFreely;
const SITE_KEY = "1x00000000000000000000AA";

type Answer = { status: number; body: unknown } | "unreachable";

// Stubs the Worker at /api/submit, recording each request body it receives.
function stubEndpoint(answer: Answer = { status: 200, body: { ok: true } }) {
  const bodies: unknown[] = [];
  global.fetch = jest.fn(
    async (_url: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      if (answer === "unreachable") throw new TypeError("Failed to fetch");
      // jsdom has no Response; the form reads only its JSON.
      const { status, body } = answer;
      return { ok: status < 400, status, json: async () => body } as Response;
    }
  );
  return bodies;
}

function renderForm() {
  return render(<SubmitForm copy={copy} siteKey={SITE_KEY} />);
}

async function fillIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByRole("textbox", { name: copy.form.message.label }),
    "Why do pastors wear skinny jeans?"
  );
  await user.click(screen.getByRole("checkbox", { name: copy.form.consent }));
}

const send = () => screen.getByRole("button", { name: copy.form.send });

describe("SubmitForm", () => {
  let turnstile: ReturnType<typeof fakeTurnstile>;
  beforeEach(() => {
    turnstile = fakeTurnstile();
  });

  it("sends a Question by default and says it was received", async () => {
    const user = userEvent.setup();
    const bodies = stubEndpoint();
    renderForm();
    turnstile.pass("token-1");
    await fillIn(user);
    await user.click(send());

    expect(bodies).toEqual([
      {
        type: "question",
        message: "Why do pastors wear skinny jeans?",
        name: "",
        email: "",
        consent: true,
        website: "",
        turnstileToken: "token-1",
      },
    ]);
    expect(
      await screen.findByRole("heading", { name: copy.sent.title })
    ).toHaveFocus();
    expect(screen.getByText(copy.sent.text.text)).toBeVisible();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("sends nothing until the message and consent are given, and says what's missing", async () => {
    const user = userEvent.setup();
    const bodies = stubEndpoint();
    renderForm();
    turnstile.pass("token-1");
    await user.click(send());

    expect(bodies).toEqual([]);
    const message = screen.getByRole("textbox", {
      name: copy.form.message.label,
    });
    expect(message).toHaveFocus();
    expect(message).toBeInvalid();
    expect(message).toHaveAccessibleDescription(
      copy.problems["message-missing"].text
    );
    expect(
      screen.getByRole("checkbox", { name: copy.form.consent })
    ).toHaveAccessibleDescription(copy.problems["consent-missing"].text);
  });

  it("clears a problem as soon as the listener fixes it", async () => {
    const user = userEvent.setup();
    stubEndpoint();
    renderForm();
    turnstile.pass("token-1");
    await fillIn(user);
    const email = screen.getByRole("textbox", { name: copy.form.email.label });
    await user.type(email, "dan@redeemer");
    await user.click(send());
    expect(email).toHaveFocus();
    expect(email).toHaveAccessibleDescription(
      `${copy.form.email.hint} ${copy.problems["email-invalid"].text}`
    );

    await user.type(email, ".church");
    expect(email).toHaveAccessibleDescription(copy.form.email.hint);
    expect(email).toBeValid();
  });

  it("refuses a name longer than the Worker allows", async () => {
    const user = userEvent.setup();
    const bodies = stubEndpoint();
    renderForm();
    turnstile.pass("token-1");
    await fillIn(user);
    const name = screen.getByRole("textbox", { name: copy.form.name.label });
    await user.click(name);
    await user.paste("A".repeat(101));
    await user.click(send());

    expect(bodies).toEqual([]);
    expect(name).toHaveFocus();
    expect(name).toHaveAccessibleDescription(
      `${copy.form.name.hint} ${copy.problems["name-invalid"].text}`
    );
  });

  it("waits for Turnstile's check before sending", async () => {
    const user = userEvent.setup();
    const bodies = stubEndpoint();
    renderForm();
    await fillIn(user);
    await user.click(send());

    expect(bodies).toEqual([]);
    expect(screen.getByRole("alert")).toHaveTextContent(
      copy.problems.unverified.text
    );

    turnstile.pass("token-1");
    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
    await user.click(send());
    expect(bodies).toHaveLength(1);
  });

  it("waits for a fresh check once the last one expires", async () => {
    const user = userEvent.setup();
    const bodies = stubEndpoint();
    renderForm();
    turnstile.pass("token-1");
    turnstile.expire();
    await fillIn(user);
    await user.click(send());

    expect(bodies).toEqual([]);
    expect(screen.getByRole("alert")).toHaveTextContent(
      copy.problems.unverified.text
    );
  });

  it("sends the chosen type, the name, and the email", async () => {
    const user = userEvent.setup();
    const bodies = stubEndpoint();
    renderForm();
    turnstile.pass("token-1");
    await user.click(
      screen.getByRole("combobox", { name: copy.form.type.label })
    );
    await user.click(
      screen.getByRole("option", { name: copy.form.type.options.confession })
    );
    await user.type(
      screen.getByRole("textbox", { name: copy.form.name.label }),
      "Brother Mark"
    );
    await user.type(
      screen.getByRole("textbox", { name: copy.form.email.label }),
      "mark@example.com"
    );
    await fillIn(user);
    await user.click(send());

    expect(bodies).toEqual([
      expect.objectContaining({
        type: "confession",
        name: "Brother Mark",
        email: "mark@example.com",
      }),
    ]);
  });

  it.each([
    ["delivery", { status: 502, body: { ok: false, error: "delivery" } }],
    [
      "verification",
      { status: 403, body: { ok: false, error: "verification" } },
    ],
    [
      "invalid",
      { status: 400, body: { ok: false, error: "invalid", field: "email" } },
    ],
    ["unreachable", "unreachable"],
    ["unreachable", { status: 405, body: null }],
  ] as const)(
    "explains a %s failure and keeps what was written",
    async (failure, answer) => {
      const user = userEvent.setup();
      stubEndpoint(answer);
      renderForm();
      turnstile.pass("token-1");
      await fillIn(user);
      await user.click(send());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        copy.failed[failure].text
      );
      expect(
        screen.getByRole("textbox", { name: copy.form.message.label })
      ).toHaveValue("Why do pastors wear skinny jeans?");
      expect(send()).toBeEnabled();
    }
  );

  it("shows a problem made after a failed send at once", async () => {
    const user = userEvent.setup();
    stubEndpoint({ status: 502, body: { ok: false, error: "delivery" } });
    renderForm();
    turnstile.pass("token-1");
    await fillIn(user);
    await user.click(send());
    await screen.findByText(copy.failed.delivery.text);

    const message = screen.getByRole("textbox", {
      name: copy.form.message.label,
    });
    await user.clear(message);
    expect(message).toHaveAccessibleDescription(
      copy.problems["message-missing"].text
    );
  });

  it("asks Turnstile for a fresh token after each send, since a token passes once", async () => {
    const user = userEvent.setup();
    const bodies = stubEndpoint({
      status: 502,
      body: { ok: false, error: "delivery" },
    });
    renderForm();
    turnstile.pass("token-1");
    await fillIn(user);
    await user.click(send());
    await screen.findByText(copy.failed.delivery.text);
    expect(turnstile.rendered).toHaveLength(2);

    turnstile.pass("token-2");
    await user.click(send());
    expect(
      bodies.map((b) => (b as { turnstileToken: string }).turnstileToken)
    ).toEqual(["token-1", "token-2"]);
  });

  it("starts a fresh Submission from the confirmation", async () => {
    const user = userEvent.setup();
    stubEndpoint();
    renderForm();
    turnstile.pass("token-1");
    await fillIn(user);
    await user.click(send());
    await user.click(
      await screen.findByRole("button", { name: copy.sent.again })
    );

    expect(
      screen.getByRole("textbox", { name: copy.form.message.label })
    ).toHaveValue("");
    expect(
      screen.getByRole("checkbox", { name: copy.form.consent })
    ).not.toBeChecked();
    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
  });

  it("matches the widget to a theme chosen with the toggle", () => {
    document.documentElement.dataset.theme = "dark";
    renderForm();
    delete document.documentElement.dataset.theme;
    expect(turnstile.rendered.map((o) => [o.sitekey, o.theme])).toEqual([
      [SITE_KEY, "dark"],
    ]);
  });

  it("follows the system theme when none is chosen", () => {
    renderForm();
    expect(turnstile.rendered.map((o) => o.theme)).toEqual(["auto"]);
  });

  it("is disabled in the page's HTML until its script runs, so nothing typed is lost or sent without it", () => {
    document.body.innerHTML = renderToString(
      <SubmitForm copy={copy} siteKey={SITE_KEY} />
    );
    try {
      expect(screen.getByRole("group")).toBeDisabled();
      expect(
        screen.getByRole("textbox", { name: copy.form.message.label })
      ).toBeDisabled();
      expect(send()).toBeDisabled();
    } finally {
      document.body.innerHTML = "";
    }
  });

  it("is ready to fill in once its script runs", () => {
    renderForm();
    expect(
      screen.getByRole("textbox", { name: copy.form.message.label })
    ).toBeEnabled();
  });

  it("hides the honeypot from people", () => {
    renderForm();
    expect(
      screen.queryByRole("textbox", { name: copy.form.honeypot })
    ).not.toBeInTheDocument();
    // The same query finds it once hidden elements count, so it's there.
    expect(
      screen.getByRole("textbox", { name: copy.form.honeypot, hidden: true })
    ).toBeInTheDocument();
  });

  it("has no detectable accessibility violations while showing problems", async () => {
    const user = userEvent.setup();
    stubEndpoint();
    const { container } = renderForm();
    await user.click(send());
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no detectable accessibility violations once sent", async () => {
    const user = userEvent.setup();
    stubEndpoint();
    const { container } = renderForm();
    turnstile.pass("token-1");
    await fillIn(user);
    await user.click(send());
    await screen.findByRole("heading", { name: copy.sent.title });
    expect(await axe(container)).toHaveNoViolations();
  });
});
