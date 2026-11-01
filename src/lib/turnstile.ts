// Cloudflare Turnstile on the page: the part of its browser API the Submit
// form uses, and which site key a build puts in the widget. The Worker checks
// the widget's token with the secret key (src/worker/adapters.ts).

export const TURNSTILE_SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// Turnstile's documented always-pass test key, for builds that never reach a
// visitor: CI, local builds, and screenshots. Its tokens pass only the test
// secret, so a deployed Worker refuses them.
export const TEST_SITE_KEY = "1x00000000000000000000AA";

export type TurnstileOptions = {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
  theme: "light" | "dark" | "auto";
  size: "flexible";
};

// window.turnstile, once its script has loaded.
export type TurnstileApi = {
  render(container: HTMLElement, options: TurnstileOptions): string | undefined;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * The site key for this build. Deploys set TURNSTILE_SITE_KEY from the
 * repository secret; any other build gets the test key. A deploy whose secret
 * is missing sets it empty, and fails here rather than ship a form no
 * Submission can pass.
 */
export function turnstileSiteKey(env: {
  readonly TURNSTILE_SITE_KEY?: string;
}): string {
  const key = env.TURNSTILE_SITE_KEY;
  if (key === undefined) return TEST_SITE_KEY;
  if (key.trim() === "") {
    throw new Error(
      "TURNSTILE_SITE_KEY is set but empty: add the Turnstile site key to the repository's secrets"
    );
  }
  return key.trim();
}
