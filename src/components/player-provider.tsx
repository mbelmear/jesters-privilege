"use client";

import {
  createContext,
  use,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Player, PlayerState } from "@/lib/player";

/** The site's one player store, or null until it starts in the browser. */
export const PlayerContext = createContext<Player | null>(null);

type Props = {
  // What the lock screen shows beneath the Episode's title.
  showName: string;
  children: React.ReactNode;
};

// The store and its browser adapters are their own chunk, fetched once the
// page is running, so they never hold up its first paint.
const loadPlayer = () =>
  Promise.all([import("@/lib/player"), import("@/lib/player-browser")]);

/**
 * Starts the player store once the page is running, over an <audio> element
 * that lives as long as the root layout, so playback carries on across
 * client-side navigation.
 */
export function PlayerProvider({ showName, children }: Props) {
  const audio = useRef<HTMLAudioElement>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadPlayer()
      .then(([{ createPlayer }, browser]) => {
        if (cancelled || !audio.current) return;
        setPlayer(
          createPlayer({
            audio: browser.audioElementAdapter(audio.current),
            storage: browser.deviceStorage(),
            mediaSession: browser.browserMediaSession(showName),
          })
        );
      })
      .catch(reportPlayerError);
    return () => {
      cancelled = true;
    };
  }, [showName]);
  return (
    <PlayerContext value={player}>
      {children}
      <audio ref={audio} preload="none" />
    </PlayerContext>
  );
}

export function usePlayer(): Player | null {
  return use(PlayerContext);
}

const noPlayer = () => () => {};

/** The store's state, re-rendering on each change; null until it starts. */
export function usePlayerState(player: Player | null): PlayerState | null {
  return useSyncExternalStore(
    player?.subscribe ?? noPlayer,
    () => player?.getState() ?? null,
    () => null
  );
}

/**
 * For a command's rejection: the store already shows the failure, so this
 * only puts the error where developers look, as an uncaught one would be.
 */
export function reportPlayerError(error: unknown) {
  window.reportError(error);
}
