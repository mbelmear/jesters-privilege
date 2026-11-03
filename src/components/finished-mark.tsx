"use client";

import { Check } from "lucide-react";
import { usePlayer, usePlayerState } from "./player-provider";

type Props = {
  guid: string;
  label: string;
};

/**
 * A check beside an Episode heard to the end on this device, after a "·"
 * that follows the date and length before it. The device's history is read
 * in the browser, so the built page shows none.
 */
export function FinishedMark({ guid, label }: Props) {
  const state = usePlayerState(usePlayer());
  if (!state?.finished.has(guid)) return null;
  return (
    <>
      {/* Spaces for an inline line; a flex line drops them. */}{" "}
      <span aria-hidden="true">·</span>{" "}
      <span className="inline-flex items-center gap-1">
        <Check aria-hidden="true" className="size-4" />
        {label}
      </span>
    </>
  );
}
