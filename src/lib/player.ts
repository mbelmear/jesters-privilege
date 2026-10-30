// The player store: the single owner of playback (spec, "Persistent player").
// Archive rows, Episode pages, the Transcript, and the player UI send it
// commands and render its state. It drives the <audio> element only through
// an injected AudioAdapter, so it runs in tests without real audio.

import type { PlayableEpisode } from "./feed";

export const SPEEDS = [1, 1.25, 1.5, 2] as const;
export type Speed = (typeof SPEEDS)[number];

// What the audio element reports back.
export type AudioEvent =
  | { type: "play" }
  | { type: "pause" }
  // Playback stops to wait for the network, then carries on.
  | { type: "waiting" }
  | { type: "playing" }
  | { type: "time"; position: number }
  | { type: "duration"; duration: number }
  // The audio can't go on: its file is missing, or the network failed.
  | { type: "error" }
  | { type: "ended" };

export type AudioAdapter = {
  load: (src: string) => void;
  play: () => Promise<void>;
  pause: () => void;
  seek: (seconds: number) => void;
  setRate: (rate: Speed) => void;
  subscribe: (listener: (event: AudioEvent) => void) => () => void;
};

// What the lock screen, Control Center, and car controls show.
export type NowPlaying = { title: string; artworkUrl: string };
export type MediaPosition = {
  duration: number;
  position: number;
  playbackRate: number;
};
export type MediaPlaybackState = "none" | "playing" | "paused";

// The controls the player answers. Track buttons skip, since there's no queue.
export const MEDIA_ACTIONS = [
  "play",
  "pause",
  "seekto",
  "seekbackward",
  "seekforward",
  "previoustrack",
  "nexttrack",
] as const;
export type MediaAction = (typeof MEDIA_ACTIONS)[number];
export type MediaActionDetails = { seekTime?: number; seekOffset?: number };
export type MediaActionHandler = (details: MediaActionDetails) => void;

// The Media Session API, or what stands in for it.
export type MediaSessionAdapter = {
  setMetadata: (nowPlaying: NowPlaying) => void;
  setPlaybackState: (state: MediaPlaybackState) => void;
  setPositionState: (position: MediaPosition) => void;
  setActionHandler: (action: MediaAction, handler: MediaActionHandler) => void;
};

// localStorage, or what stands in for it. Null where the browser has none.
export type DeviceStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export type PlayerDeps = {
  audio: AudioAdapter;
  storage?: DeviceStorage | null;
  mediaSession?: MediaSessionAdapter | null;
  // Receives failures no caller can catch, such as a lock-screen play that
  // can't start. By default they are thrown as uncaught errors.
  onError?: (error: Error) => void;
};

type LoadedEpisode = {
  episode: PlayableEpisode;
  position: number;
  duration: number;
};

export type PlayerState = {
  speed: Speed;
  // The guids of Episodes heard to the end on this device.
  finished: ReadonlySet<string>;
} & (
  | { mode: "empty" }
  // Buffering: playing, but waiting for the network to send more audio.
  | ({ mode: "playing"; buffering: boolean } & LoadedEpisode)
  | ({ mode: "paused" } & LoadedEpisode)
  // The audio broke off; playing again reloads it and carries on from here.
  | ({ mode: "failed" } & LoadedEpisode)
);

type LoadedState = Exclude<PlayerState, { mode: "empty" }>;

function playing(state: LoadedState): LoadedState {
  const { speed, finished, episode, position, duration } = state;
  const buffering = state.mode === "playing" && state.buffering;
  return {
    mode: "playing",
    buffering,
    speed,
    finished,
    episode,
    position,
    duration,
  };
}

function stopped(state: LoadedState, mode: "paused" | "failed"): LoadedState {
  const { speed, finished, episode, position, duration } = state;
  return { mode, speed, finished, episode, position, duration };
}

export const SKIP_BACK_SECONDS = 15;
export const SKIP_FORWARD_SECONDS = 30;

// A place earlier than this isn't worth offering to resume.
export const RESUME_MIN_SECONDS = 10;
// While playing, the place is saved each time it moves this far, so a page
// closed mid-Episode loses at most this much.
const SAVE_EVERY_SECONDS = 5;

export const PLAYER_STORAGE_KEY = "player";

export type Player = {
  getState: () => PlayerState;
  subscribe: (listener: () => void) => () => void;
  /** Plays an Episode, from `at` seconds if given. The loaded Episode carries on where it is. */
  play: (episode: PlayableEpisode, options?: { at?: number }) => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  toggle: () => Promise<void>;
  seek: (seconds: number) => void;
  skipBack: () => void;
  skipForward: () => void;
  setSpeed: (speed: Speed) => void;
  /** Where a partly heard Episode was left on this device, or null. */
  savedPosition: (guid: string) => number | null;
  /** The Episode last played on this device, if it was left partly heard. */
  resumeOffer: () => { guid: string; position: number } | null;
};

export function createPlayer({
  audio,
  storage = null,
  mediaSession = null,
  onError = (error) =>
    queueMicrotask(() => {
      throw error;
    }),
}: PlayerDeps): Player {
  const history = createHistory(storage);
  let state: PlayerState = {
    mode: "empty",
    speed: 1,
    finished: history.finished(),
  };
  // Counts loads, so a late answer from the audio about an Episode that has
  // since been replaced is ignored.
  let loadCount = 0;
  // About the loaded Episode: whether the audio has reported its real length
  // (the feed's figure is an estimate, and may be short or 0), and whether
  // playback has just reached the end.
  let durationKnown = false;
  let heardToEnd = false;
  const listeners = new Set<() => void>();

  // The Episode the lock screen shows, so its artwork is sent once per load.
  let lockScreenEpisode: PlayableEpisode | null = null;

  function setState(next: PlayerState) {
    state = next;
    if (mediaSession && state.mode !== "empty") {
      showOnLockScreen(
        mediaSession,
        state,
        state.episode !== lockScreenEpisode
      );
      lockScreenEpisode = state.episode;
    }
    for (const listener of listeners) listener();
  }

  function onAudio(event: AudioEvent) {
    if (state.mode === "empty") return;
    switch (event.type) {
      case "play":
        return setState(playing(state));
      case "pause":
        history.savePosition(state.episode.guid, state.position, { now: true });
        return setState(stopped(state, "paused"));
      case "waiting":
      case "playing":
        if (state.mode !== "playing") return;
        return setState({ ...state, buffering: event.type === "waiting" });
      case "time":
        history.savePosition(state.episode.guid, event.position);
        return setState({ ...state, position: event.position });
      case "error":
        history.savePosition(state.episode.guid, state.position, { now: true });
        return setState(stopped(state, "failed"));
      case "duration":
        durationKnown = true;
        return setState({ ...state, duration: event.duration });
      case "ended":
        heardToEnd = true;
        history.finish(state.episode.guid);
        return setState({
          ...stopped(state, "paused"),
          finished: history.finished(),
        });
      default: {
        const unhandled: never = event;
        return unhandled;
      }
    }
  }
  audio.subscribe(onAudio);

  // Asks the audio to play, from the start again if it was heard to the end.
  // A browser may refuse, as when autoplay is blocked, or abandon the attempt
  // when a new Episode loads; the store then shows paused. Any other failure,
  // such as audio it can't decode, is thrown.
  async function startAudio() {
    if (state.mode === "empty") return;
    if (heardToEnd) seek(0);
    if (state.mode === "failed") {
      audio.load(state.episode.audioUrl);
      audio.setRate(state.speed);
      durationKnown = false;
      seek(state.position);
    }
    const load = loadCount;
    setState(playing(state));
    try {
      await audio.play();
    } catch (error: unknown) {
      const refused = isRefusal(error);
      if (load === loadCount)
        setState(stopped(state, refused ? "paused" : "failed"));
      if (refused) return;
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Can't play Episode "${state.episode.title}" from ${state.episode.audioUrl}: ${reason}`,
        { cause: error }
      );
    }
  }

  function seek(seconds: number) {
    if (state.mode === "empty") return;
    const end = durationKnown ? state.duration : Infinity;
    const position = Math.min(Math.max(seconds, 0), end);
    heardToEnd = false;
    audio.seek(position);
    history.savePosition(state.episode.guid, position, { now: true });
    setState({ ...state, position });
  }

  const player: Player = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async play(episode, { at } = {}) {
      if (state.mode === "empty" || state.episode.guid !== episode.guid) {
        loadCount += 1;
        durationKnown = false;
        heardToEnd = false;
        audio.load(episode.audioUrl);
        audio.setRate(state.speed);
        history.markLastPlayed(episode.guid);
        // Subscribers hear of the load once it is playing, not as a pause.
        state = {
          mode: "paused",
          speed: state.speed,
          finished: state.finished,
          episode,
          position: 0,
          duration: episode.durationSeconds,
        };
      }
      if (at !== undefined) seek(at);
      await startAudio();
    },
    pause() {
      if (state.mode === "empty") return;
      audio.pause();
    },
    resume: startAudio,
    async toggle() {
      if (state.mode === "playing") audio.pause();
      else await startAudio();
    },
    seek,
    skipBack() {
      if (state.mode === "empty") return;
      seek(state.position - SKIP_BACK_SECONDS);
    },
    skipForward() {
      if (state.mode === "empty") return;
      seek(state.position + SKIP_FORWARD_SECONDS);
    },
    setSpeed(speed) {
      audio.setRate(speed);
      setState({ ...state, speed });
    },
    savedPosition: history.position,
    resumeOffer() {
      const guid = history.lastPlayed();
      const position = guid === null ? null : history.position(guid);
      return guid === null || position === null ? null : { guid, position };
    },
  };

  if (mediaSession) {
    for (const action of MEDIA_ACTIONS) {
      mediaSession.setActionHandler(action, (details) =>
        answerMediaAction(player, action, details, onError)
      );
    }
  }
  return player;
}

function showOnLockScreen(
  session: MediaSessionAdapter,
  next: Exclude<PlayerState, { mode: "empty" }>,
  newEpisode: boolean
) {
  if (newEpisode) {
    session.setMetadata({
      title: next.episode.title,
      artworkUrl: next.episode.artworkUrl,
    });
  }
  session.setPlaybackState(next.mode === "playing" ? "playing" : "paused");
  // The system rejects a position without a known, positive duration.
  if (Number.isFinite(next.duration) && next.duration > 0) {
    session.setPositionState({
      duration: next.duration,
      position: Math.min(next.position, next.duration),
      playbackRate: next.speed,
    });
  }
}

function answerMediaAction(
  player: Player,
  action: MediaAction,
  { seekTime, seekOffset }: MediaActionDetails,
  onError: (error: Error) => void
) {
  const state = player.getState();
  const position = state.mode === "empty" ? 0 : state.position;
  switch (action) {
    case "play":
      return void player.resume().catch(onError);
    case "pause":
      return player.pause();
    case "seekto":
      return seekTime === undefined ? undefined : player.seek(seekTime);
    case "seekbackward":
      return player.seek(position - (seekOffset ?? SKIP_BACK_SECONDS));
    case "seekforward":
      return player.seek(position + (seekOffset ?? SKIP_FORWARD_SECONDS));
    case "previoustrack":
      return player.skipBack();
    case "nexttrack":
      return player.skipForward();
    default: {
      const unhandled: never = action;
      return unhandled;
    }
  }
}

// What this device remembers of the Episodes played on it.
type Saved = {
  positions: Record<string, number>;
  finished: string[];
  lastPlayed: string | null;
};

// Keeps the listening history in memory and mirrors it to storage. Storage
// may refuse every read and write (private browsing, a full quota); playback
// never depends on it, so a failure leaves only this page's memory.
function createHistory(storage: DeviceStorage | null) {
  const saved = read(storage);
  const lastWritten = new Map<string, number>();

  function write() {
    try {
      storage?.setItem(PLAYER_STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // Unsaved: resume works for the rest of this visit only.
    }
  }

  return {
    finished: (): ReadonlySet<string> => new Set(saved.finished),
    lastPlayed: () => saved.lastPlayed,
    position(guid: string): number | null {
      const position = saved.positions[guid];
      return position !== undefined && position >= RESUME_MIN_SECONDS
        ? position
        : null;
    },
    markLastPlayed(guid: string) {
      saved.lastPlayed = guid;
      write();
    },
    savePosition(guid: string, position: number, { now = false } = {}) {
      saved.positions[guid] = position;
      const last = lastWritten.get(guid) ?? 0;
      if (now || Math.abs(position - last) >= SAVE_EVERY_SECONDS) {
        lastWritten.set(guid, position);
        write();
      }
    },
    finish(guid: string) {
      delete saved.positions[guid];
      if (!saved.finished.includes(guid)) saved.finished.push(guid);
      write();
    },
  };
}

function read(storage: DeviceStorage | null): Saved {
  const empty: Saved = { positions: {}, finished: [], lastPlayed: null };
  try {
    const text = storage?.getItem(PLAYER_STORAGE_KEY);
    if (!text) return empty;
    const value: unknown = JSON.parse(text);
    return parseSaved(value) ?? empty;
  } catch {
    return empty;
  }
}

/** Narrows what storage held to a listening history, or null if it isn't one. */
function parseSaved(value: unknown): Saved | null {
  if (typeof value !== "object" || value === null) return null;
  const positions = "positions" in value ? value.positions : undefined;
  const finished = "finished" in value ? value.finished : undefined;
  const lastPlayed = "lastPlayed" in value ? value.lastPlayed : null;
  if (typeof positions !== "object" || positions === null) return null;
  const entries: [string, unknown][] = Object.entries(positions);
  if (!entries.every(isSavedPosition)) return null;
  if (!Array.isArray(finished)) return null;
  const guids: unknown[] = finished;
  if (!guids.every((guid) => typeof guid === "string")) return null;
  if (lastPlayed !== null && typeof lastPlayed !== "string") return null;
  return {
    positions: Object.fromEntries(entries),
    finished: guids,
    lastPlayed,
  };
}

function isSavedPosition(entry: [string, unknown]): entry is [string, number] {
  const [, position] = entry;
  return (
    typeof position === "number" && Number.isFinite(position) && position >= 0
  );
}

// How a browser declines to play: autoplay blocked, or interrupted by a load.
function isRefusal(error: unknown): error is DOMException {
  return (
    error instanceof DOMException &&
    (error.name === "NotAllowedError" || error.name === "AbortError")
  );
}
