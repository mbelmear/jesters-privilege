"use client";

import { useEffect, useRef } from "react";
import { parseTheme } from "@/lib/theme";
import {
  TURNSTILE_SCRIPT,
  type TurnstileApi,
  type TurnstileOptions,
} from "@/lib/turnstile";

type Props = {
  siteKey: string;
  // A fresh token once the challenge passes, null once it expires or fails.
  // Each token is good for one Submission, so the form remounts the widget
  // (a new `key`) after each send for the next.
  onToken: (token: string | null) => void;
};

/**
 * Cloudflare's Turnstile check, which proves a person is sending without a
 * puzzle. Its script loads only on the page that shows it, after first paint.
 */
export function TurnstileWidget({ siteKey, onToken }: Props) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let widgetId: string | undefined;
    let removed = false;
    const mount = (api: TurnstileApi) => {
      if (removed) return;
      widgetId = api.render(element, {
        sitekey: siteKey,
        callback: (token) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
        theme: widgetTheme(),
        size: "flexible",
      });
    };
    const loaded = window.turnstile;
    if (loaded) mount(loaded);
    else
      loadTurnstile().then(mount, (error: unknown) =>
        console.error("Speak Freely: Turnstile's script didn't load", error)
      );
    return () => {
      removed = true;
      if (widgetId !== undefined) window.turnstile?.remove(widgetId);
    };
  }, [siteKey, onToken]);

  return <div ref={container} data-turnstile className="min-h-16.5" />;
}

let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error(`${TURNSTILE_SCRIPT} set no window.turnstile`));
    };
    script.onerror = () => {
      // Let a remount try again.
      loading = null;
      reject(new Error(`${TURNSTILE_SCRIPT} failed to load`));
    };
    document.head.append(script);
  });
  return loading;
}

// The widget matches a theme chosen with the toggle; otherwise it follows the
// system setting, as the page does.
function widgetTheme(): TurnstileOptions["theme"] {
  return parseTheme(document.documentElement.dataset.theme) ?? "auto";
}
