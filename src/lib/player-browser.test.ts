import type { AudioEvent } from "./player";
import {
  audioElementAdapter,
  browserMediaSession,
  deviceStorage,
} from "./player-browser";

describe("audioElementAdapter", () => {
  // jsdom has no media playback, so the element's own play and pause are
  // stood in for.
  function setup() {
    const element = document.createElement("audio");
    jest.spyOn(element, "play").mockResolvedValue();
    jest.spyOn(element, "pause").mockImplementation(() => {});
    const adapter = audioElementAdapter(element);
    const events: AudioEvent[] = [];
    const unsubscribe = adapter.subscribe((event) => events.push(event));
    return { element, adapter, events, unsubscribe };
  }

  it("loads, plays, pauses, seeks, and sets the speed of the element", async () => {
    const { element, adapter } = setup();
    adapter.load("https://example.com/ep-1.mp3");
    expect(element.src).toBe("https://example.com/ep-1.mp3");
    await adapter.play();
    expect(element.play).toHaveBeenCalled();
    adapter.pause();
    expect(element.pause).toHaveBeenCalled();
    adapter.seek(42);
    expect(element.currentTime).toBe(42);
    adapter.setRate(1.5);
    expect(element.playbackRate).toBe(1.5);
    // A new source starts at the default rate, so that is kept too.
    expect(element.defaultPlaybackRate).toBe(1.5);
  });

  it("reports what the element does", () => {
    const { element, events } = setup();
    element.dispatchEvent(new Event("play"));
    element.currentTime = 12;
    element.dispatchEvent(new Event("timeupdate"));
    element.dispatchEvent(new Event("waiting"));
    element.dispatchEvent(new Event("playing"));
    element.dispatchEvent(new Event("pause"));
    element.dispatchEvent(new Event("ended"));
    element.dispatchEvent(new Event("error"));
    expect(events).toEqual([
      { type: "play" },
      { type: "time", position: 12 },
      { type: "waiting" },
      { type: "playing" },
      { type: "pause" },
      { type: "ended" },
      { type: "error" },
    ]);
  });

  it("reports a duration only once the element knows it", () => {
    const { element, events } = setup();
    const duration = jest.spyOn(element, "duration", "get");
    duration.mockReturnValue(NaN);
    element.dispatchEvent(new Event("durationchange"));
    duration.mockReturnValue(Infinity);
    element.dispatchEvent(new Event("durationchange"));
    duration.mockReturnValue(3012.5);
    element.dispatchEvent(new Event("durationchange"));
    expect(events).toEqual([{ type: "duration", duration: 3012.5 }]);
  });

  it("stops reporting once unsubscribed", () => {
    const { element, events, unsubscribe } = setup();
    unsubscribe();
    element.dispatchEvent(new Event("play"));
    expect(events).toEqual([]);
  });
});

describe("browserMediaSession", () => {
  class FakeMediaMetadata {
    constructor(readonly init: unknown) {}
  }

  function install(session: object | undefined) {
    Object.defineProperty(navigator, "mediaSession", {
      configurable: true,
      value: session,
    });
    Object.defineProperty(window, "MediaMetadata", {
      configurable: true,
      writable: true,
      value: FakeMediaMetadata,
    });
  }

  afterEach(() => {
    Reflect.deleteProperty(navigator, "mediaSession");
    Reflect.deleteProperty(window, "MediaMetadata");
  });

  it("is absent where the browser has no Media Session", () => {
    expect(browserMediaSession("Jester's Privilege")).toBeNull();
  });

  it("shows the Episode as the show's, with its artwork", () => {
    const session = { metadata: null, playbackState: "none" };
    install(session);
    browserMediaSession("Jester's Privilege")?.setMetadata({
      title: "Celebrity Pastors",
      artworkUrl: "https://example.com/ep-1.jpg",
    });
    expect(session.metadata).toEqual(
      new FakeMediaMetadata({
        title: "Celebrity Pastors",
        artist: "Jester's Privilege",
        album: "Jester's Privilege",
        artwork: [{ src: "https://example.com/ep-1.jpg" }],
      })
    );
  });

  it("passes on the playback state, position, and handlers", () => {
    const session = {
      playbackState: "none",
      setPositionState: jest.fn(),
      setActionHandler: jest.fn(),
    };
    install(session);
    const adapter = browserMediaSession("Jester's Privilege");
    adapter?.setPlaybackState("playing");
    adapter?.setPositionState({ duration: 60, position: 5, playbackRate: 1 });
    const handler = () => {};
    adapter?.setActionHandler("seekto", handler);
    expect(session.playbackState).toBe("playing");
    expect(session.setPositionState).toHaveBeenCalledWith({
      duration: 60,
      position: 5,
      playbackRate: 1,
    });
    expect(session.setActionHandler).toHaveBeenCalledWith("seekto", handler);
  });

  it("goes without what this browser doesn't support", () => {
    const refuse = () => {
      throw new TypeError("not supported");
    };
    install({ setPositionState: refuse, setActionHandler: refuse });
    const adapter = browserMediaSession("Jester's Privilege");
    expect(() =>
      adapter?.setPositionState({ duration: 60, position: 5, playbackRate: 1 })
    ).not.toThrow();
    expect(() => adapter?.setActionHandler("seekto", () => {})).not.toThrow();
  });
});

describe("deviceStorage", () => {
  afterEach(() => jest.restoreAllMocks());

  it("is the browser's localStorage", () => {
    expect(deviceStorage()).toBe(window.localStorage);
  });

  it("is absent where reaching storage is refused", () => {
    jest.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(deviceStorage()).toBeNull();
  });
});
