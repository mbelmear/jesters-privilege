// A stand-in for the <audio> element behind an AudioAdapter, for testing the
// player store and anything that drives it. It copies the element's behaviour
// that the store depends on:
//
// - Loading a new source stops playback and starts it again at 0.
// - The duration is unknown until reportDuration(), as with real audio, whose
//   length arrives after its metadata loads. The Feed's figure is an estimate.
// - Reaching the end fires pause and then ended, and play() after that starts
//   again from 0.
//
// One difference: the element queues its events as tasks, so they arrive after
// the code that caused them, but this fake emits them at once.

import type { AudioAdapter, AudioEvent } from "./player";

export class FakeAudio implements AudioAdapter {
  src: string | null = null;
  position = 0;
  duration: number | null = null;
  rate = 1;
  playing = false;
  ended = false;
  // Refuse play() as a browser blocking autoplay does.
  rejectPlay = false;
  private listeners = new Set<(event: AudioEvent) => void>();

  load(src: string) {
    this.src = src;
    this.position = 0;
    this.duration = null;
    this.playing = false;
    this.ended = false;
  }
  play() {
    if (this.rejectPlay)
      return Promise.reject(new DOMException("Blocked", "NotAllowedError"));
    if (this.ended) {
      this.ended = false;
      this.seek(0);
    }
    this.playing = true;
    this.emit({ type: "play" });
    return Promise.resolve();
  }
  pause() {
    this.playing = false;
    this.emit({ type: "pause" });
  }
  seek(seconds: number) {
    this.position = seconds;
    this.ended = false;
    this.emit({ type: "time", position: seconds });
  }
  setRate(rate: number) {
    this.rate = rate;
  }
  subscribe(listener: (event: AudioEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit(event: AudioEvent) {
    for (const listener of this.listeners) listener(event);
  }

  /** The audio's metadata loads and reveals its real length. */
  reportDuration(seconds: number) {
    this.duration = seconds;
    this.emit({ type: "duration", duration: seconds });
  }
  /** Playback reaches a moment on its own. */
  playTo(seconds: number) {
    this.position = seconds;
    this.emit({ type: "time", position: seconds });
  }
  /** Playback reaches the end, at the real duration once it is known. */
  end() {
    this.playTo(this.duration ?? this.position);
    this.playing = false;
    this.ended = true;
    this.emit({ type: "pause" });
    this.emit({ type: "ended" });
  }
}
