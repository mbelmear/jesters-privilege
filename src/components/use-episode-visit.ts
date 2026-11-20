"use client";

import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import type { PlayableEpisode } from "@/lib/feed";
import {
  momentLabel,
  momentLink,
  parseMoment,
  sharedMoment,
  type Arrival,
} from "@/lib/moment";
import type { ShareTarget } from "@/lib/share";
import { useLoadedEpisode, usePlayerState } from "./player-provider";

// The page's query string, which holds a Moment link's moment. The built HTML
// has none, so the page renders plain until it hydrates.
const noSubscription = () => () => {};
const useSearch = () =>
  useSyncExternalStore(
    noSubscription,
    () => window.location.search,
    () => ""
  );

export type EpisodeVisit = {
  // How the Visit began, until anything plays; from then on, "none".
  arrival: Arrival["kind"];
  share: MomentShare;
};

/** What Share sends: the whole Episode, or a Moment link. */
export type MomentShare = {
  // The moment on offer while this Episode is in the player, less a lead-in
  // as it plays; null hides the box.
  moment: number | null;
  // Whether the box is ticked, holding the moment where it was.
  frozen: boolean;
  setFrozen: (frozen: boolean) => void;
  // The plain link, or once frozen the Moment link with a line naming the
  // moment, `shareText` read before its time ("Listen from 12:34").
  target: (plain: ShareTarget, shareText: string) => ShareTarget;
};

/**
 * A Visit to an Episode page (GLOSSARY.md): how it began, plain or by a Moment
 * link, and what Share sends. A Visit that arrives on a Moment link finds the
 * Episode in the player, paused at the moment: a browser won't play audio
 * before a tap.
 */
export function useEpisodeVisit(episode: PlayableEpisode): EpisodeVisit {
  const { player, loaded } = useLoadedEpisode(episode.guid);
  const state = usePlayerState(player);
  const arrival = parseMoment(useSearch(), episode.durationSeconds);
  const at = arrival.kind === "moment" ? arrival.seconds : null;
  // Once anything plays, the Visit is like any other.
  const [played, setPlayed] = useState(false);
  if (state?.mode === "playing" && !played) setPlayed(true);

  // Before the page paints, so a resume offer never shows in its place. Only
  // for a fresh player: the Moment link is how this Visit began.
  useLayoutEffect(() => {
    if (at === null || !player || player.getState().mode !== "empty") return;
    player.load(episode, { at });
  }, [player, episode, at]);

  // The moment the box held when ticked; null while it is unticked.
  const [frozen, setFrozen] = useState<number | null>(null);
  // A box hidden with the Episode comes back unticked.
  if (!loaded && frozen !== null) setFrozen(null);
  const moment = loaded ? sharedMoment(loaded.position, frozen) : null;

  return {
    arrival: played ? "none" : arrival.kind,
    share: {
      moment,
      frozen: frozen !== null,
      setFrozen: (on) => setFrozen(on ? moment : null),
      target: (plain, shareText) =>
        moment !== null && frozen !== null
          ? {
              title: plain.title,
              url: momentLink(plain.url, moment),
              text: momentLabel(shareText, moment),
            }
          : plain,
    },
  };
}
