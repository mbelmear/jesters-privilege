// The Cloudflare side of the Submit endpoint: the Turnstile verifier and email
// sender that src/lib/submit.ts takes as injected dependencies.

import type { Email, SubmitDeps } from "@/lib/submit";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// The show's inbox. wrangler.jsonc pins the email binding to this address too.
const TO = "hello@jestersprivilegepodcast.com";
const FROM = {
  email: "submit@jestersprivilegepodcast.com",
  name: "Jester's Privilege site",
};

// The structured form of Cloudflare's send_email binding.
export type SendEmailBinding = {
  send(message: {
    from: { email: string; name: string };
    to: string;
    subject: string;
    text: string;
  }): Promise<unknown>;
};

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export function turnstileVerifier(
  secret: string,
  fetch: Fetch
): SubmitDeps["verifyTurnstile"] {
  return async (token, ip) => {
    const form = new URLSearchParams({ secret, response: token });
    if (ip !== null) form.set("remoteip", ip);
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body: form,
    });
    if (!response.ok) {
      throw new Error(`Turnstile siteverify answered ${response.status}`);
    }
    const verdict: unknown = await response.json();
    if (
      typeof verdict !== "object" ||
      verdict === null ||
      !("success" in verdict) ||
      typeof verdict.success !== "boolean"
    ) {
      throw new Error("Turnstile siteverify answered without a success flag");
    }
    return verdict.success;
  };
}

export function emailSender(
  binding: SendEmailBinding
): SubmitDeps["sendEmail"] {
  return async (email: Email) => {
    await binding.send({ from: FROM, to: TO, ...email });
  };
}
