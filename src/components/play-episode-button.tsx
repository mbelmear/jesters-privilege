"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlayerCopy } from "@/lib/content";
import type { PlayableEpisode } from "@/lib/feed";
import { formatDuration } from "@/lib/format-duration";
import {
  reportPlayerError,
  usePlayer,
  usePlayerState,
} from "./player-provider";

type Props = {
  episode: PlayableEpisode;
  // Read after each label, "Play Episode 4", so every button on a page says
  // which Episode it plays.
  name: string;
  copy: PlayerCopy;
};

/**
 * Plays an Episode in the persistent player, and pauses it while it plays.
 * An Episode left partly heard on this device offers to resume where it was
 * left, or to start over.
 */
export function PlayEpisodeButton({ episode, name, copy }: Props) {
  const player = usePlayer();
  const state = usePlayerState(player);
  const loaded =
    state && state.mode !== "empty" && state.episode.guid === episode.guid
      ? state
      : null;
  const saved = player && !loaded ? player.savedPosition(episode.guid) : null;
  const named = (label: string) => (
    <>
      {label}
      <span className="sr-only"> {name}</span>
    </>
  );

  if (loaded?.mode === "playing") {
    return (
      <Button
        type="button"
        variant="brand"
        size="lg"
        onClick={() => player?.pause()}
      >
        <Pause aria-hidden="true" className="fill-current" />
        {named(copy.pause)}
      </Button>
    );
  }
  if (loaded) {
    const heard = loaded.finished.has(episode.guid);
    return (
      <Button
        type="button"
        variant="brand"
        size="lg"
        onClick={() => player?.resume().catch(reportPlayerError)}
      >
        <Play aria-hidden="true" className="fill-current" />
        {named(heard ? copy.play : copy.resume)}
      </Button>
    );
  }
  if (saved !== null) {
    return (
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="brand"
          size="lg"
          onClick={() =>
            player?.play(episode, { at: saved }).catch(reportPlayerError)
          }
        >
          <Play aria-hidden="true" className="fill-current" />
          {named(`${copy.resume} ${copy.resumeFrom} ${formatDuration(saved)}`)}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() =>
            player?.play(episode, { at: 0 }).catch(reportPlayerError)
          }
        >
          <RotateCcw aria-hidden="true" />
          {named(copy.startOver)}
        </Button>
      </div>
    );
  }
  return (
    <Button
      type="button"
      variant="brand"
      size="lg"
      onClick={() => player?.play(episode).catch(reportPlayerError)}
    >
      <Play aria-hidden="true" className="fill-current" />
      {named(copy.play)}
    </Button>
  );
}
