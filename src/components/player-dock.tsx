"use client";

import { lazy, Suspense } from "react";
import type { PlayerCopy } from "@/lib/content";
import type { EpisodeLabels } from "@/lib/format-episode";
import { usePlayer, usePlayerState } from "./player-provider";

// The bar, with its controls and icons, is its own chunk: fetched when an
// Episode first plays, so every page ships only this empty dock.
const PlayerBar = lazy(() =>
  import("./player-bar").then((module) => ({ default: module.PlayerBar }))
);

type Props = {
  copy: PlayerCopy;
  labels: EpisodeLabels;
};

/** Where the player bar docks, empty until an Episode is played. */
export function PlayerDock({ copy, labels }: Props) {
  const state = usePlayerState(usePlayer());
  if (!state || state.mode === "empty") return null;
  return (
    <Suspense fallback={null}>
      <PlayerBar copy={copy} labels={labels} />
    </Suspense>
  );
}
