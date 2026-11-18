// Moment links: an Episode's address with ?t=<seconds>, which opens it ready
// to play from that moment (GLOSSARY.md).

import { formatDuration } from "./format-duration";

export const MOMENT_PARAM = "t";

// A shared moment starts this much before where the sharer is, so the
// listener hears the lead-up rather than landing mid-word.
export const MOMENT_LEAD_IN_SECONDS = 5;

export type Arrival =
  // A plain visit: the address has no moment.
  | { kind: "none" }
  | { kind: "moment"; seconds: number }
  // A moment that isn't in the Episode: not whole seconds, or past its end.
  | { kind: "bad" };

/** Reads the moment from an address's query string ("?t=754"). */
export function parseMoment(search: string, durationSeconds: number): Arrival {
  const value = new URLSearchParams(search).get(MOMENT_PARAM);
  if (value === null) return { kind: "none" };
  if (!/^\d+$/.test(value)) return { kind: "bad" };
  const seconds = Number(value);
  return seconds < durationSeconds
    ? { kind: "moment", seconds }
    : { kind: "bad" };
}

/**
 * The moment Share offers: the player's position less the lead-in, to the
 * second, unless the sharer froze one by ticking the box.
 */
export function sharedMoment(position: number, frozen: number | null): number {
  if (frozen !== null) return frozen;
  return Math.max(0, Math.floor(position - MOMENT_LEAD_IN_SECONDS));
}

/** An Episode's address that opens at the moment. */
export function momentLink(url: string, seconds: number): string {
  const link = new URL(url);
  link.searchParams.set(MOMENT_PARAM, String(seconds));
  return link.href;
}

/** A phrase read before a moment: "Start at" becomes "Start at 12:34". */
export function momentLabel(phrase: string, seconds: number): string {
  return `${phrase} ${formatDuration(seconds)}`;
}
