// A stand-in for window.turnstile, for testing the Submit form without
// Cloudflare's script. It records the widgets rendered and lets a test play
// the challenge's outcomes: pass(token), expire(), fail().
//
// One difference: the real widget runs its challenge after render() returns
// and calls back later, but this one calls back only when the test says so.

import { act } from "@testing-library/react";
import type { TurnstileApi, TurnstileOptions } from "./turnstile";

export type FakeTurnstile = {
  // The options each render() received, in order.
  readonly rendered: TurnstileOptions[];
  readonly pass: (token: string) => void;
  readonly expire: () => void;
  readonly fail: () => void;
};

/** Installs a fake window.turnstile and returns its controls. */
export function fakeTurnstile(): FakeTurnstile {
  const rendered: TurnstileOptions[] = [];
  const live = new Map<string, TurnstileOptions>();

  const api: TurnstileApi = {
    render(_container, options) {
      rendered.push(options);
      const id = `widget-${rendered.length}`;
      live.set(id, options);
      return id;
    },
    remove(id) {
      live.delete(id);
    },
  };
  window.turnstile = api;

  const current = (): TurnstileOptions => {
    const widgets = [...live.values()];
    const widget = widgets[widgets.length - 1];
    if (!widget) throw new Error("No Turnstile widget is rendered");
    return widget;
  };

  return {
    rendered,
    pass: (token) => act(() => current().callback(token)),
    expire: () => act(() => current()["expired-callback"]()),
    fail: () => act(() => current()["error-callback"]()),
  };
}
