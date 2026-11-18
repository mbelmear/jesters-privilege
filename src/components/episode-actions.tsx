"use client";

import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import type { EpisodePage, PlayerCopy } from "@/lib/content";
import type { PlayableEpisode } from "@/lib/feed";
import { parseMoment } from "@/lib/moment";
import { PlayEpisodeButton } from "./play-episode-button";
import { usePlayer, usePlayerState } from "./player-provider";
import { ShareButton } from "./share-button";

type Props = {
  episode: PlayableEpisode;
  // Read after Play's label, "Play Episode 4".
  name: string;
  // What the share sheet names the link.
  title: string;
  // The Episode page's path.
  path: string;
  copy: EpisodePage;
  playerCopy: PlayerCopy;
};

// The page's query string, which holds a Moment link's moment. The built HTML
// has none, so the page renders plain until it hydrates.
const noSubscription = () => () => {};
const useSearch = () =>
  useSyncExternalStore(
    noSubscription,
    () => window.location.search,
    () => ""
  );

/**
 * An Episode page's Play and Share. A visit that arrives on a Moment link
 * finds the Episode in the player, paused at the moment: a browser won't play
 * audio before a tap.
 */
export function EpisodeActions({
  episode,
  name,
  title,
  path,
  copy,
  playerCopy,
}: Props) {
  const player = usePlayer();
  const state = usePlayerState(player);
  const arrival = parseMoment(useSearch(), episode.durationSeconds);
  // Once anything plays, the visit is like any other.
  const [played, setPlayed] = useState(false);
  if (state?.mode === "playing" && !played) setPlayed(true);
  const at = arrival.kind === "moment" ? arrival.seconds : null;

  // Before the page paints, so a resume offer never shows in its place. Only
  // for a fresh player: the Moment link is how this visit began.
  useLayoutEffect(() => {
    if (at === null || !player || player.getState().mode !== "empty") return;
    player.load(episode, { at });
  }, [player, episode, at]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-3">
        <PlayEpisodeButton
          episode={episode}
          name={name}
          copy={playerCopy}
          playFrom={
            at !== null && !played ? copy.moment.playFrom.text : undefined
          }
        />
        <ShareButton
          title={title}
          path={path}
          episodeGuid={episode.guid}
          copy={copy.share}
          momentCopy={copy.moment}
        />
      </div>
      {arrival.kind === "bad" && !played && (
        <p className="font-ui text-sm text-muted-foreground">
          {copy.moment.bad.text}
        </p>
      )}
    </div>
  );
}
