import { FakeAudio } from "./fake-audio";
import type { AudioEvent } from "./player";

// The fake stands in for the <audio> element across the player's tests, so
// the element behaviour it claims to copy is pinned here.
function setup() {
  const audio = new FakeAudio();
  const events: AudioEvent[] = [];
  audio.subscribe((event) => events.push(event));
  audio.load("https://example.com/ep-1.mp3");
  return { audio, events };
}

describe("FakeAudio", () => {
  it("knows no duration until the audio reports one", () => {
    const { audio, events } = setup();
    expect(audio.duration).toBeNull();
    audio.reportDuration(3012.5);
    expect(events).toEqual([{ type: "duration", duration: 3012.5 }]);
  });

  it("fires pause and then ended when playback reaches the end", async () => {
    const { audio, events } = setup();
    audio.reportDuration(3000);
    await audio.play();
    events.length = 0;
    audio.end();
    expect(events).toEqual([
      { type: "time", position: 3000 },
      { type: "pause" },
      { type: "ended" },
    ]);
  });

  it("fires no pause at the end when already paused", () => {
    const { audio, events } = setup();
    audio.end();
    expect(events).not.toContainEqual({ type: "pause" });
  });

  it("starts again from 0 when played after the end", async () => {
    const { audio } = setup();
    audio.reportDuration(3000);
    await audio.play();
    audio.end();
    await audio.play();
    expect(audio.position).toBe(0);
    expect(audio.playing).toBe(true);
  });

  it("stops and returns to 0 when a new source loads", async () => {
    const { audio } = setup();
    await audio.play();
    audio.playTo(100);
    audio.load("https://example.com/ep-2.mp3");
    expect(audio).toMatchObject({
      position: 0,
      playing: false,
      duration: null,
    });
  });
});
