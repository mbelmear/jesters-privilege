"use client";

import { lazy, Suspense, useState } from "react";
import type { PlayerCopy } from "@/lib/content";
import type { EpisodeLabels } from "@/lib/format-episode";
import { usePlayer, usePlayerState } from "./player-provider";

// The bar and the resume offer, with their controls and icons, are their own
// chunk: fetched when there is something to show, so every page ships only
// this empty dock.
const loadBar = () => import("./player-bar");
const PlayerBar = lazy(() =>
  loadBar().then((module) => ({ default: module.PlayerBar }))
);
const ResumeOffer = lazy(() =>
  loadBar().then((module) => ({ default: module.ResumeOffer }))
);

type Props = {
  copy: PlayerCopy;
  labels: EpisodeLabels;
};

/**
 * Where the player docks: the bar once an Episode plays, and before that, on
 * a return visit, an offer to resume the Episode last left partly heard.
 */
export function PlayerDock({ copy, labels }: Props) {
  const player = usePlayer();
  const state = usePlayerState(player);
  const [declined, setDeclined] = useState(false);
  if (!player || !state) return null;
  if (state.mode === "empty") {
    const offer = declined ? null : player.resumeOffer();
    if (!offer) return null;
    return (
      <Suspense fallback={null}>
        <ResumeOffer
          offer={offer}
          onDismiss={() => setDeclined(true)}
          copy={copy}
          labels={labels}
        />
      </Suspense>
    );
  }
  return (
    <Suspense fallback={null}>
      <PlayerBar copy={copy} labels={labels} />
    </Suspense>
  );
}
