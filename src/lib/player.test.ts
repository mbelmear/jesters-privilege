import { FakeAudio } from "./fake-audio";
import type { Episode } from "./feed";
import {
  createPlayer,
  type MediaAction,
  type MediaActionDetails,
  type MediaActionHandler,
  type NowPlaying,
  type MediaPlaybackState,
  type MediaPosition,
  type PlayerDeps,
} from "./player";

function episode(overrides: Partial<Episode> = {}): Episode {
  return {
    type: "full",
    number: 1,
    guid: "ep-1",
    title: "Celebrity Pastors",
    publishedAt: new Date("2026-11-02T10:00:00Z"),
    durationSeconds: 3000,
    audioUrl: "https://example.com/ep-1.mp3",
    showNotesHtml: "<p>Notes</p>",
    excerpt: "Notes",
    artworkUrl: "https://example.com/ep-1.jpg",
    transcriptUrl: null,
    ...overrides,
  } as Episode;
}

const secondEpisode = episode({
  number: 2,
  guid: "ep-2",
  title: "Holy Fools",
  audioUrl: "https://example.com/ep-2.mp3",
  artworkUrl: "https://example.com/ep-2.jpg",
} as Partial<Episode>);

function setup(overrides: Partial<PlayerDeps> = {}) {
  const audio = new FakeAudio();
  const player = createPlayer({ audio, ...overrides });
  return { audio, player };
}

describe("player", () => {
  it("starts with nothing loaded", () => {
    const { player } = setup();
    expect(player.getState()).toMatchObject({ mode: "empty", speed: 1 });
  });

  it("loads and plays an Episode", async () => {
    const { audio, player } = setup();
    await player.play(episode());
    expect(audio.src).toBe("https://example.com/ep-1.mp3");
    expect(audio.playing).toBe(true);
    expect(player.getState()).toMatchObject({
      mode: "playing",
      episode: { guid: "ep-1" },
      position: 0,
      duration: 3000,
    });
  });

  it("follows the audio's position and its real duration", async () => {
    const { audio, player } = setup();
    await player.play(episode());
    audio.reportDuration(3012.5);
    audio.playTo(42);
    expect(player.getState()).toMatchObject({ position: 42, duration: 3012.5 });
  });

  it("shows paused when the audio stops on its own, as when headphones are unplugged", async () => {
    const { audio, player } = setup();
    await player.play(episode());
    audio.pause();
    expect(player.getState().mode).toBe("paused");
  });

  it("tells subscribers about every change until they unsubscribe", async () => {
    const { audio, player } = setup();
    const seen: string[] = [];
    const unsubscribe = player.subscribe(() =>
      seen.push(player.getState().mode)
    );
    await player.play(episode());
    unsubscribe();
    audio.pause();
    expect(seen).toContain("playing");
    expect(seen).not.toContain("paused");
  });

  it("ignores a refusal to play an Episode that another has replaced", async () => {
    const { audio, player } = setup();
    let refuse: (error: Error) => void = () => {};
    audio.play = () =>
      new Promise((_, reject) => {
        refuse = reject;
      });
    const first = player.play(episode());
    audio.playTo(1);
    audio.play = FakeAudio.prototype.play;
    await player.play(secondEpisode);
    refuse(new DOMException("Interrupted", "AbortError"));
    await first;
    expect(player.getState()).toMatchObject({
      mode: "playing",
      episode: { guid: "ep-2" },
    });
  });

  it("pauses and resumes", async () => {
    const { audio, player } = setup();
    await player.play(episode());
    audio.playTo(10);
    player.pause();
    expect(player.getState()).toMatchObject({ mode: "paused", position: 10 });
    await player.resume();
    expect(audio.playing).toBe(true);
    expect(player.getState()).toMatchObject({ mode: "playing", position: 10 });
  });

  it("toggles between playing and paused", async () => {
    const { player } = setup();
    await player.play(episode());
    await player.toggle();
    expect(player.getState().mode).toBe("paused");
    await player.toggle();
    expect(player.getState().mode).toBe("playing");
  });

  it("ignores transport commands with nothing loaded", async () => {
    const { audio, player } = setup();
    player.pause();
    await player.resume();
    await player.toggle();
    player.seek(30);
    player.skipForward();
    player.skipBack();
    expect(audio.src).toBeNull();
    expect(player.getState().mode).toBe("empty");
  });

  it("carries on with the loaded Episode when asked to play it again", async () => {
    const { audio, player } = setup();
    await player.play(episode());
    audio.playTo(600);
    player.pause();
    await player.play(episode());
    expect(audio.position).toBe(600);
    expect(player.getState()).toMatchObject({ mode: "playing", position: 600 });
  });

  it("starts an Episode at a given moment, as a Transcript timestamp does", async () => {
    const { audio, player } = setup();
    await player.play(episode());
    await player.play(secondEpisode, { at: 754 });
    expect(audio.src).toBe("https://example.com/ep-2.mp3");
    expect(audio.position).toBe(754);
    expect(player.getState()).toMatchObject({
      mode: "playing",
      episode: { guid: "ep-2" },
      position: 754,
    });
  });

  it("seeks within the loaded Episode, as a Transcript timestamp does", async () => {
    const { audio, player } = setup();
    await player.play(episode());
    await player.play(episode(), { at: 120 });
    expect(audio.position).toBe(120);
  });

  it("seeks, keeping within the Episode", async () => {
    const { audio, player } = setup();
    await player.play(episode());
    audio.reportDuration(3000);
    player.seek(1500);
    expect(audio.position).toBe(1500);
    expect(player.getState()).toMatchObject({ position: 1500 });
    player.seek(-5);
    expect(audio.position).toBe(0);
    player.seek(9999);
    expect(audio.position).toBe(3000);
  });

  it("skips back 15 seconds and forward 30", async () => {
    const { audio, player } = setup();
    await player.play(episode());
    audio.playTo(100);
    player.skipBack();
    expect(audio.position).toBe(85);
    player.skipForward();
    expect(audio.position).toBe(115);
  });

  it("doesn't skip past either end", async () => {
    const { audio, player } = setup();
    await player.play(episode());
    audio.reportDuration(3000);
    audio.playTo(5);
    player.skipBack();
    expect(audio.position).toBe(0);
    audio.playTo(2990);
    player.skipForward();
    expect(audio.position).toBe(3000);
  });

  it.each([1, 1.25, 1.5, 2] as const)("plays at %s×", async (speed) => {
    const { audio, player } = setup();
    await player.play(episode());
    player.setSpeed(speed);
    expect(audio.rate).toBe(speed);
    expect(player.getState().speed).toBe(speed);
  });

  it("keeps the chosen speed for the next Episode", async () => {
    const { audio, player } = setup();
    player.setSpeed(1.5);
    await player.play(episode());
    expect(audio.rate).toBe(1.5);
    audio.rate = 1;
    await player.play(secondEpisode);
    expect(audio.rate).toBe(1.5);
  });

  describe("on the lock screen and car controls", () => {
    // Records what the operating system would show, and lets a test press
    // its buttons.
    function fakeMediaSession() {
      const handlers = new Map<MediaAction, MediaActionHandler>();
      const session = {
        metadata: null as NowPlaying | null,
        playbackState: "none" as MediaPlaybackState,
        position: null as MediaPosition | null,
        press: (action: MediaAction, details: MediaActionDetails = {}) =>
          handlers.get(action)?.(details),
        adapter: {
          setMetadata: (metadata: NowPlaying) => {
            session.metadata = metadata;
          },
          setPlaybackState: (state: MediaPlaybackState) => {
            session.playbackState = state;
          },
          setPositionState: (position: MediaPosition) => {
            session.position = position;
          },
          setActionHandler: (
            action: MediaAction,
            handler: MediaActionHandler
          ) => void handlers.set(action, handler),
        },
      };
      return session;
    }

    async function playing() {
      const session = fakeMediaSession();
      const { audio, player } = setup({ mediaSession: session.adapter });
      await player.play(episode());
      audio.reportDuration(3000);
      audio.playTo(100);
      return { audio, player, session };
    }

    it("shows the Episode's title and artwork", async () => {
      const { session } = await playing();
      expect(session.metadata).toEqual({
        title: "Celebrity Pastors",
        artworkUrl: "https://example.com/ep-1.jpg",
      });
    });

    it("shows whether it is playing, and where", async () => {
      const { player, session } = await playing();
      expect(session.playbackState).toBe("playing");
      player.setSpeed(1.5);
      expect(session.position).toEqual({
        duration: 3000,
        position: 100,
        playbackRate: 1.5,
      });
      player.pause();
      expect(session.playbackState).toBe("paused");
    });

    it("plays and pauses from the lock screen", async () => {
      const { audio, session } = await playing();
      session.press("pause");
      expect(audio.playing).toBe(false);
      session.press("play");
      expect(audio.playing).toBe(true);
    });

    it("seeks to where the lock screen's scrub bar is dragged", async () => {
      const { audio, session } = await playing();
      session.press("seekto", { seekTime: 2000 });
      expect(audio.position).toBe(2000);
    });

    it("skips by the player's own steps from seek and track buttons", async () => {
      const { audio, session } = await playing();
      session.press("seekbackward");
      expect(audio.position).toBe(85);
      session.press("seekforward");
      expect(audio.position).toBe(115);
      session.press("previoustrack");
      expect(audio.position).toBe(100);
      session.press("nexttrack");
      expect(audio.position).toBe(130);
    });

    it("skips by the offset the system asks for", async () => {
      const { audio, session } = await playing();
      session.press("seekforward", { seekOffset: 10 });
      expect(audio.position).toBe(110);
      session.press("seekbackward", { seekOffset: 5 });
      expect(audio.position).toBe(105);
    });

    it("reports a failure to play from the lock screen", async () => {
      const session = fakeMediaSession();
      const errors: unknown[] = [];
      const { audio, player } = setup({
        mediaSession: session.adapter,
        onError: (error) => errors.push(error),
      });
      await player.play(episode());
      player.pause();
      audio.play = () =>
        Promise.reject(new DOMException("No source", "NotSupportedError"));
      session.press("play");
      await Promise.resolve();
      await Promise.resolve();
      expect(errors).toHaveLength(1);
      expect(errors[0]).toHaveProperty(
        "message",
        'Can\'t play Episode "Celebrity Pastors" from https://example.com/ep-1.mp3: No source'
      );
    });

    it("leaves out the position while the duration is unknown", async () => {
      const session = fakeMediaSession();
      const { audio, player } = setup({ mediaSession: session.adapter });
      await player.play(episode({ durationSeconds: 0 }));
      audio.playTo(3);
      expect(session.position).toBeNull();
    });
  });

  describe("on this device", () => {
    // A stand-in for localStorage, shared by the players made in one test the
    // way one browser's storage outlives a page load.
    function memoryStorage() {
      const items = new Map<string, string>();
      return {
        getItem: (key: string) => items.get(key) ?? null,
        setItem: (key: string, value: string) => void items.set(key, value),
      };
    }

    async function listenTo(seconds: number, storage = memoryStorage()) {
      const { audio, player } = setup({ storage });
      await player.play(episode());
      audio.playTo(seconds);
      player.pause();
      return { audio, player, storage };
    }

    it("offers to resume a partly heard Episode on a return visit", async () => {
      const { storage } = await listenTo(1234);
      const { player } = setup({ storage });
      expect(player.savedPosition("ep-1")).toBe(1234);
      // Only what playing it needs, so any page can offer it.
      expect(player.resumeOffer()).toEqual({
        episode: {
          type: "full",
          number: 1,
          guid: "ep-1",
          title: "Celebrity Pastors",
          durationSeconds: 3000,
          audioUrl: "https://example.com/ep-1.mp3",
          artworkUrl: "https://example.com/ep-1.jpg",
        },
        position: 1234,
      });
    });

    it("resumes from the offered position", async () => {
      const { storage } = await listenTo(1234);
      const { audio, player } = setup({ storage });
      const offer = player.resumeOffer();
      if (!offer) throw new Error("No resume offer");
      await player.play(offer.episode, { at: offer.position });
      expect(audio.src).toBe("https://example.com/ep-1.mp3");
      expect(audio.position).toBe(1234);
    });

    it("offers nothing on a first visit", () => {
      const { player } = setup({ storage: memoryStorage() });
      expect(player.savedPosition("ep-1")).toBeNull();
      expect(player.resumeOffer()).toBeNull();
    });

    it("doesn't offer to resume an Episode barely started", async () => {
      const { storage } = await listenTo(4);
      const { player } = setup({ storage });
      expect(player.savedPosition("ep-1")).toBeNull();
      expect(player.resumeOffer()).toBeNull();
    });

    it("remembers each Episode's place separately", async () => {
      const { audio, player, storage } = await listenTo(1234);
      await player.play(secondEpisode);
      audio.playTo(300);
      player.pause();
      const later = setup({ storage }).player;
      expect(later.savedPosition("ep-1")).toBe(1234);
      expect(later.savedPosition("ep-2")).toBe(300);
      expect(later.resumeOffer()).toMatchObject({
        episode: { guid: "ep-2", title: "Holy Fools" },
        position: 300,
      });
    });

    it("keeps the exact place of an Episode switched away from mid-play", async () => {
      const storage = memoryStorage();
      const { audio, player } = setup({ storage });
      await player.play(episode());
      audio.playTo(1233);
      audio.playTo(1234);
      await player.play(secondEpisode);
      expect(setup({ storage }).player.savedPosition("ep-1")).toBe(1234);
    });

    it("keeps the place while playing, should the page close mid-Episode", async () => {
      const storage = memoryStorage();
      const { audio, player } = setup({ storage });
      await player.play(episode());
      for (let second = 1; second <= 61; second++) audio.playTo(second);
      expect(
        setup({ storage }).player.savedPosition("ep-1")
      ).toBeGreaterThanOrEqual(56);
    });

    it("marks an Episode heard to the end as finished", async () => {
      const storage = memoryStorage();
      const { audio, player } = setup({ storage });
      await player.play(episode());
      audio.playTo(2999);
      audio.end();
      expect(player.getState().finished.has("ep-1")).toBe(true);
      expect(player.getState().mode).toBe("paused");
      const later = setup({ storage }).player;
      expect(later.getState().finished.has("ep-1")).toBe(true);
      expect(later.savedPosition("ep-1")).toBeNull();
      expect(later.resumeOffer()).toBeNull();
    });

    it("starts with no Episodes finished", () => {
      const { player } = setup({ storage: memoryStorage() });
      expect(player.getState().finished.size).toBe(0);
    });

    it("plays on when storage is unavailable, as in private browsing", async () => {
      const refusing = {
        getItem: () => {
          throw new Error("SecurityError");
        },
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      };
      const { audio, player } = setup({ storage: refusing });
      await player.play(episode());
      audio.playTo(100);
      audio.end();
      expect(player.getState().finished.has("ep-1")).toBe(true);
      expect(player.savedPosition("ep-1")).toBeNull();
      expect(player.resumeOffer()).toBeNull();
    });

    it("plays on with no storage at all", async () => {
      const { audio, player } = setup({ storage: null });
      await player.play(episode());
      expect(audio.playing).toBe(true);
      expect(player.resumeOffer()).toBeNull();
    });

    // As stored before the last Episode was remembered whole, or damaged.
    it.each(['"ep-1"', '{"guid":"ep-1"}'])(
      "keeps each place, offering nothing, when the last Episode reads %s",
      (lastPlayed) => {
        const storage = memoryStorage();
        storage.setItem(
          "player",
          `{"positions":{"ep-1":1234},"finished":[],"lastPlayed":${lastPlayed}}`
        );
        const { player } = setup({ storage });
        expect(player.savedPosition("ep-1")).toBe(1234);
        expect(player.resumeOffer()).toBeNull();
      }
    );

    it.each([
      "not json",
      "null",
      "[]",
      '{"positions":{"ep-1":"soon"},"finished":"ep-2"}',
      '{"positions":{"ep-1":-3},"finished":[7],"lastPlayed":4}',
    ])("starts afresh when what's stored is unreadable: %s", (stored) => {
      const storage = memoryStorage();
      storage.setItem("player", stored);
      const { player } = setup({ storage });
      expect(player.savedPosition("ep-1")).toBeNull();
      expect(player.getState().finished.size).toBe(0);
      expect(player.resumeOffer()).toBeNull();
    });
  });

  it("plays a finished Episode again from the start", async () => {
    const { audio, player } = setup();
    await player.play(episode());
    audio.playTo(3000);
    audio.end();
    // A real element restarts by itself, after the store reports playing;
    // the store shows the start from its first word.
    const shown: number[] = [];
    player.subscribe(() => {
      const state = player.getState();
      if (state.mode === "playing") shown.push(state.position);
    });
    await player.play(episode());
    expect(shown[0]).toBe(0);
    expect(audio.position).toBe(0);
    expect(player.getState()).toMatchObject({ mode: "playing", position: 0 });
  });

  it("fails loudly, naming the Episode, when its audio can't be played", async () => {
    const { audio, player } = setup();
    audio.play = () =>
      Promise.reject(new DOMException("No source", "NotSupportedError"));
    await expect(player.play(episode())).rejects.toThrow(
      'Can\'t play Episode "Celebrity Pastors" from https://example.com/ep-1.mp3: No source'
    );
    expect(player.getState().mode).toBe("failed");
  });

  it("trusts the audio over the feed's duration, which may be short", async () => {
    const { audio, player } = setup();
    await player.play(episode(), { at: 3050 });
    expect(audio.position).toBe(3050);
    player.pause();
    await player.resume();
    expect(audio.position).toBe(3050);
  });

  it("carries on mid-Episode when the feed gives no duration", async () => {
    const { audio, player } = setup();
    await player.play(episode({ durationSeconds: 0 }));
    audio.playTo(50);
    player.pause();
    await player.toggle();
    expect(audio.position).toBe(50);
  });

  it("carries on from the very end when sought there, rather than restarting", async () => {
    const { audio, player } = setup();
    await player.play(episode());
    audio.reportDuration(3000);
    player.pause();
    player.seek(3000);
    await player.resume();
    expect(audio.position).toBe(3000);
  });

  it("shows when playback waits for the network, until the audio carries on", async () => {
    const { audio, player } = setup();
    await player.play(episode());
    expect(player.getState()).toMatchObject({ buffering: false });
    audio.stall();
    expect(player.getState()).toMatchObject({
      mode: "playing",
      buffering: true,
    });
    audio.carryOn();
    expect(player.getState()).toMatchObject({
      mode: "playing",
      buffering: false,
    });
  });

  it("shows a failure when the audio breaks off mid-Episode, and retries from there", async () => {
    const { audio, player } = setup();
    await player.play(episode());
    audio.playTo(600);
    audio.fail();
    expect(player.getState()).toMatchObject({ mode: "failed", position: 600 });
    audio.src = null;
    await player.resume();
    expect(audio.src).toBe("https://example.com/ep-1.mp3");
    expect(audio.position).toBe(600);
    expect(player.getState()).toMatchObject({ mode: "playing", position: 600 });
  });

  it("shows paused when the browser refuses to start playback", async () => {
    const { audio, player } = setup();
    audio.rejectPlay = true;
    await player.play(episode());
    expect(player.getState()).toMatchObject({
      mode: "paused",
      episode: { guid: "ep-1" },
    });
  });
});
