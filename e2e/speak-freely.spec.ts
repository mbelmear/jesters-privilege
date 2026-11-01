import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

// The Speak Freely page's form against Turnstile's real widget, which the build gives the
// always-pass test key (src/lib/turnstile.ts). The static server has no
// Worker, so each test answers POST /api/submit itself.
const PAGE = "/speak-freely";

// The widget's hidden input holds its token once the challenge has passed.
async function passTurnstile(page: Page) {
  await expect
    .poll(
      () =>
        page
          .locator('[data-turnstile] input[name="cf-turnstile-response"]')
          .inputValue()
          .catch(() => ""),
      { timeout: 20_000 }
    )
    .not.toBe("");
}

async function fillIn(page: Page) {
  await page
    .getByRole("textbox", { name: "Message" })
    .fill("Why do pastors wear skinny jeans?");
  await page
    .getByRole("checkbox", { name: "You can mention this on the show." })
    .click();
}

const send = (page: Page) => page.getByRole("button", { name: "Send" });
// The form's own alert; Next's route announcer is one too.
const alert = (page: Page) => page.getByRole("form").getByRole("alert");

// Answers the endpoint as the Worker would, keeping each body it was sent.
async function answerSubmit(
  page: Page,
  status: number,
  body: unknown
): Promise<unknown[]> {
  const bodies: unknown[] = [];
  await page.route("**/api/submit", async (route: Route) => {
    bodies.push(route.request().postDataJSON());
    await route.fulfill({ status, json: body });
  });
  return bodies;
}

test.describe("Speak Freely", () => {
  test("sends a Submission with Turnstile's token and confirms it", async ({
    page,
  }) => {
    const bodies = await answerSubmit(page, 200, { ok: true });
    await page.goto(PAGE);
    await fillIn(page);
    await passTurnstile(page);
    await send(page).click();

    await expect(page.getByRole("heading", { name: "Received" })).toBeFocused();
    expect(bodies).toEqual([
      expect.objectContaining({
        type: "question",
        message: "Why do pastors wear skinny jeans?",
        consent: true,
        website: "",
        turnstileToken: expect.stringMatching(/.+/),
      }),
    ]);
  });

  test("explains a failed send and keeps what was written", async ({
    page,
  }) => {
    await answerSubmit(page, 502, { ok: false, error: "delivery" });
    await page.goto(PAGE);
    await fillIn(page);
    await passTurnstile(page);
    await send(page).click();

    await expect(alert(page)).toContainText("didn't reach the Jesters' inbox");
    await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue(
      "Why do pastors wear skinny jeans?"
    );
  });

  test("explains a Submission Turnstile refused", async ({ page }) => {
    await answerSubmit(page, 403, { ok: false, error: "verification" });
    await page.goto(PAGE);
    await fillIn(page);
    await passTurnstile(page);
    await send(page).click();

    await expect(alert(page)).toContainText(
      "couldn't confirm this came from a person"
    );
  });

  test("sends a Confession from the keyboard alone", async ({ page }) => {
    const bodies = await answerSubmit(page, 200, { ok: true });
    await page.goto(PAGE);
    await passTurnstile(page);
    const type = page.getByRole("combobox", { name: "Type" });
    await type.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("option", { name: "Confession" }).focus();
    await page.keyboard.press("Enter");
    await expect(type).toHaveText("Confession");
    await expect(type).toBeFocused();

    await page.getByRole("textbox", { name: "Message" }).focus();
    await page.keyboard.type("I skipped the sermon for brunch.");
    const consent = page.getByRole("checkbox", {
      name: "You can mention this on the show.",
    });
    await consent.focus();
    await page.keyboard.press("Space");
    await page.getByRole("textbox", { name: "Email" }).focus();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { name: "Received" })).toBeFocused();
    expect(bodies).toEqual([
      expect.objectContaining({
        type: "confession",
        message: "I skipped the sermon for brunch.",
      }),
    ]);
  });

  test("names what's missing, from the keyboard alone", async ({ page }) => {
    const bodies = await answerSubmit(page, 200, { ok: true });
    await page.goto(PAGE);
    await passTurnstile(page);
    await page.getByRole("textbox", { name: "Email" }).fill("dan@redeemer");
    await page.getByRole("textbox", { name: "Email" }).press("Enter");

    const message = page.getByRole("textbox", { name: "Message" });
    await expect(message).toBeFocused();
    await expect(message).toHaveAccessibleDescription(
      "Write your message before you send it."
    );
    await page.keyboard.type("A Confession");
    // Desktop Safari's Tab skips buttons, as the checkbox is, so it's focused
    // directly; Space ticks it as it does a native one.
    const consent = page.getByRole("checkbox", {
      name: "You can mention this on the show.",
    });
    await consent.focus();
    await page.keyboard.press("Space");
    await expect(consent).toBeChecked();
    expect(bodies).toEqual([]);
  });

  test("stays disabled until its script runs, so nothing typed is lost", async ({
    page,
  }) => {
    // With the scripts blocked the page never hydrates, the state a slow
    // phone shows for a moment. The other tests type into the same fields once
    // it has, so this check can tell the two apart.
    let aborted = 0;
    await page.route(/\/_next\/static\/chunks\/.*\.js/, (route) => {
      aborted += 1;
      return route.abort();
    });
    await page.goto(PAGE);
    expect(aborted).toBeGreaterThan(0);
    await expect(page.getByRole("textbox", { name: "Message" })).toBeDisabled();
    await expect(send(page)).toBeDisabled();
  });

  test("has no horizontal scroll", async ({ page }) => {
    await page.goto(PAGE);
    await passTurnstile(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`has no detectable accessibility violations (${colorScheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(PAGE);
      await send(page).click();
      await expect(
        page.getByRole("textbox", { name: "Message" })
      ).toHaveAttribute("aria-invalid", "true");
      // Turnstile's widget is Cloudflare's frame, not ours to fix.
      const results = await new AxeBuilder({ page })
        .exclude("[data-turnstile]")
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
