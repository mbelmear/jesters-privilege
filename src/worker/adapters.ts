// The Cloudflare side of the Submit endpoint: the Turnstile verifier and email
// sender that src/lib/submit.ts takes as injected dependencies.

import { site } from "@/content/site";
import type { Email, SubmitDeps } from "@/lib/submit";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const FROM = {
  email: "submit@jestersprivilegepodcast.com",
  name: `${site.name} site`,
};

// siteverify answers success:false for a bad secret too. That's our fault, not
// the listener's, so it fails loudly instead of reading as a rejected token.
const SECRET_ERRORS = ["missing-input-secret", "invalid-input-secret"];

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
    const codes =
      "error-codes" in verdict && Array.isArray(verdict["error-codes"])
        ? verdict["error-codes"].filter((c) => typeof c === "string")
        : [];
    const secretErrors = codes.filter((c) => SECRET_ERRORS.includes(c));
    if (secretErrors.length > 0) {
      throw new Error(
        `Turnstile siteverify refused TURNSTILE_SECRET_KEY: ${secretErrors.join(", ")}`
      );
    }
    return verdict.success;
  };
}

export function emailSender(
  binding: SendEmailBinding
): SubmitDeps["sendEmail"] {
  return async (email: Email) => {
    await binding.send({ from: FROM, to: site.contactEmail, ...email });
  };
}
