// The one Worker in front of the static export. Cloudflare routes every
// request here first (`run_worker_first` in wrangler.jsonc) so the www host can
// be redirected and POST /api/submit handled; everything else is served from
// the built files in out/. Its hourly Cron Trigger (`triggers` in
// wrangler.jsonc, production only) starts the feed check (ADR 0004).

import { startFeedCheck } from "@/lib/feed-check-start";
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
  // Set on production only: the preview Worker has no Cron Trigger.
  DEPLOY_DISPATCH_TOKEN?: string;
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
        verifyTurnstile: turnstileVerifier(
          env.TURNSTILE_SECRET_KEY,
          (url, init) => fetch(url, init)
        ),
        sendEmail: emailSender(env.SUBMISSION_EMAIL),
      });
    }
    return env.ASSETS.fetch(request);
  },

  // A throw marks the scheduled event failed in Workers Logs; Deploy's own
  // schedule notices when none has started a feed check for 3 hours.
  async scheduled(_controller: unknown, env: Env): Promise<void> {
    await startFeedCheck(
      env.DEPLOY_DISPATCH_TOKEN,
      // Wrapped: the Workers runtime refuses a detached global fetch.
      (url, init) => fetch(url, init),
      (line) => console.log(line)
    );
  },
};

export default worker;
