import { expect, type Page, type Route } from "@playwright/test";

// Helpers for driving the Speak Freely form against Turnstile's real widget,
// which the build gives the always-pass test key (src/lib/turnstile.ts). The
// static server has no Worker, so whoever drives the form answers
// POST /api/submit itself.

// The widget's hidden input holds its token once the challenge has passed.
export async function passTurnstile(page: Page) {
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

// Answers the endpoint as the Worker would, keeping each body it was sent.
export async function answerSubmit(
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
