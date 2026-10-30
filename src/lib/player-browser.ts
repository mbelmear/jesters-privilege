// The browser's side of the player store's adapters: the <audio> element, the
// Media Session API, and localStorage. Each is a thin pass-through, so the
// store's behaviour lives in ./player, where it is tested against fakes.

import type {
  AudioAdapter,
  AudioEvent,
  DeviceStorage,
  MediaSessionAdapter,
} from "./player";

export function audioElementAdapter(element: HTMLAudioElement): AudioAdapter {
  return {
    load(src) {
      element.src = src;
    },
    play: () => element.play(),
    pause: () => element.pause(),
    seek(seconds) {
      element.currentTime = seconds;
    },
    setRate(rate) {
      element.playbackRate = rate;
      element.defaultPlaybackRate = rate;
    },
    subscribe(listener) {
      const report: Record<string, () => AudioEvent | null> = {
        play: () => ({ type: "play" }),
        pause: () => ({ type: "pause" }),
        timeupdate: () => ({ type: "time", position: element.currentTime }),
        // NaN before the metadata loads, Infinity for a live stream.
        durationchange: () =>
          Number.isFinite(element.duration)
            ? { type: "duration", duration: element.duration }
            : null,
        ended: () => ({ type: "ended" }),
      };
      const handlers = Object.entries(report).map(
        ([name, toEvent]) =>
          [
            name,
            () => {
              const event = toEvent();
              if (event) listener(event);
            },
          ] as const
      );
      for (const [name, handler] of handlers)
        element.addEventListener(name, handler);
      return () => {
        for (const [name, handler] of handlers)
          element.removeEventListener(name, handler);
      };
    },
  };
}

/** The lock screen's controls, or null where the browser has none. */
export function browserMediaSession(
  showName: string
): MediaSessionAdapter | null {
  if (!("mediaSession" in navigator)) return null;
  const session = navigator.mediaSession;
  return {
    setMetadata({ title, artworkUrl }) {
      session.metadata = new MediaMetadata({
        title,
        artist: showName,
        album: showName,
        artwork: [{ src: artworkUrl }],
      });
    },
    setPlaybackState(state) {
      session.playbackState = state;
    },
    // Browsers differ in what they support and throw at the rest, which the
    // lock screen then simply doesn't offer.
    setPositionState(position) {
      try {
        session.setPositionState(position);
      } catch {}
    },
    setActionHandler(action, handler) {
      try {
        session.setActionHandler(action, handler);
      } catch {}
    },
  };
}

/** localStorage, or null where the browser refuses it. */
export function deviceStorage(): DeviceStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
