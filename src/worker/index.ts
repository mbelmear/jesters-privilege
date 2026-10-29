// The one Worker in front of the static export. Cloudflare routes every
// request here first (`run_worker_first` in wrangler.jsonc) so the www host can
// be redirected and POST /api/submit handled; everything else is served from
// the built files in out/.

import { handleSubmit } from "@/lib/submit";
import {
  emailSender,
  turnstileVerifier,
  type SendEmailBinding,
} from "./adapters";

const APEX = "jestersprivilegepodcast.com";

type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  TURNSTILE_SECRET_KEY: string;
  SUBMISSION_EMAIL: SendEmailBinding;
};

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.hostname === `www.${APEX}`) {
      url.hostname = APEX;
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === "/api/submit") {
      if (request.method !== "POST") {
        return new Response(null, { status: 405, headers: { Allow: "POST" } });
      }
      return handleSubmit(request, {
        // Wrapped: the Workers runtime refuses a detached global fetch.
        verifyTurnstile: turnstileVerifier(env.TURNSTILE_SECRET_KEY, (u, i) =>
          fetch(u, i)
        ),
        sendEmail: emailSender(env.SUBMISSION_EMAIL),
      });
    }
    return env.ASSETS.fetch(request);
  },
};

export default worker;
