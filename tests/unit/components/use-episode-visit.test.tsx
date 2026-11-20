import { act, renderHook } from "@testing-library/react";
import { FakeAudio } from "@/lib/fake-audio";
import type { PlayableEpisode } from "@/lib/feed";
import { createPlayer } from "@/lib/player";
import { PlayerContext } from "@/components/player-provider";
import { useEpisodeVisit } from "@/components/use-episode-visit";

const episode: PlayableEpisode = {
  type: "full",
  number: 4,
  guid: "https://api.spreaker.com/episode/4",
  title: "Is Humor a Virtue?",
  durationSeconds: 2577,
  audioUrl: "https://example.com/ep-4.mp3",
  artworkUrl: "https://example.com/art.jpg",
};

const another: PlayableEpisode = {
  ...episode,
  number: 5,
  guid: "https://api.spreaker.com/episode/5",
  audioUrl: "https://example.com/ep-5.mp3",
};

// Opens the page at an address, as a visitor following a link would.
function visit(path: string) {
  window.history.replaceState(null, "", path);
}

function setup(player = createPlayer({ audio: new FakeAudio() })) {
  const result = renderHook(() => useEpisodeVisit(episode), {
    wrapper: ({ children }) => (
      <PlayerContext value={player}>{children}</PlayerContext>
    ),
  });
  return { player, ...result };
}

afterEach(() => visit("/"));

describe("useEpisodeVisit", () => {
  describe("how the visit began", () => {
    it("is plain without a moment in the address", () => {
      visit("/episodes/4");
      const { player, result } = setup();
      expect(result.current.arrival).toBe("none");
      expect(player.getState().mode).toBe("empty");
    });

    it("loads the Episode paused at a Moment link's moment", () => {
      visit("/episodes/4?t=754");
      const { player, result } = setup();
      expect(result.current.arrival).toBe("moment");
      const state = player.getState();
      expect(state.mode).toBe("paused");
      expect(state.mode !== "empty" && state.episode.guid).toBe(episode.guid);
      expect(state.mode !== "empty" && state.position).toBe(754);
    });

    it("leaves a player already holding an Episode as it is", async () => {
      visit("/episodes/4?t=754");
      const player = createPlayer({ audio: new FakeAudio() });
      await player.play(another);
      setup(player);
      const state = player.getState();
      expect(state.mode !== "empty" && state.episode.guid).toBe(another.guid);
    });

    it("is a bad moment when the moment isn't in the Episode, loading nothing", () => {
      visit("/episodes/4?t=9999");
      const { player, result } = setup();
      expect(result.current.arrival).toBe("bad");
      expect(player.getState().mode).toBe("empty");
    });

    it("stays a Moment link until anything plays, then is plain", async () => {
      visit("/episodes/4?t=754");
      const { player, result } = setup();
      act(() => player.pause());
      expect(result.current.arrival).toBe("moment");
      await act(() => player.resume());
      expect(result.current.arrival).toBe("none");
      act(() => player.pause());
      expect(result.current.arrival).toBe("none");
    });

    it("drops a bad moment once another Episode plays", async () => {
      visit("/episodes/4?t=-3");
      const { player, result } = setup();
      await act(() => player.play(another));
      expect(result.current.arrival).toBe("none");
    });
  });

  describe("what Share sends", () => {
    const plain = { title: "Episode 4", url: "https://example.com/episodes/4" };

    it("offers no moment while this Episode isn't in the player", async () => {
      visit("/episodes/4");
      const { player, result } = setup();
      expect(result.current.share.moment).toBeNull();
      await act(() => player.play(another));
      expect(result.current.share.moment).toBeNull();
    });

    it("offers the position less a lead-in, to the second, sending the plain link", async () => {
      visit("/episodes/4");
      const audio = new FakeAudio();
      const { player, result } = setup(createPlayer({ audio }));
      await act(() => player.play(episode));
      act(() => audio.playTo(759.6));
      expect(result.current.share.moment).toBe(754);
      expect(result.current.share.frozen).toBe(false);
      expect(result.current.share.target(plain, "Hear it from")).toEqual(plain);
    });

    it("never offers a moment before the start", async () => {
      visit("/episodes/4");
      const audio = new FakeAudio();
      const { player, result } = setup(createPlayer({ audio }));
      await act(() => player.play(episode));
      act(() => audio.playTo(3));
      expect(result.current.share.moment).toBe(0);
    });

    it("freezes the moment, sending a Moment link that names it", async () => {
      visit("/episodes/4");
      const audio = new FakeAudio();
      const { player, result } = setup(createPlayer({ audio }));
      await act(() => player.play(episode));
      act(() => audio.playTo(759));
      act(() => result.current.share.setFrozen(true));
      act(() => audio.playTo(900));
      expect(result.current.share.moment).toBe(754);
      expect(result.current.share.frozen).toBe(true);
      expect(result.current.share.target(plain, "Hear it from")).toEqual({
        title: "Episode 4",
        url: "https://example.com/episodes/4?t=754",
        text: "Hear it from 12:34",
      });
    });

    it("follows playback again once unfrozen", async () => {
      visit("/episodes/4");
      const audio = new FakeAudio();
      const { player, result } = setup(createPlayer({ audio }));
      await act(() => player.play(episode));
      act(() => audio.playTo(759));
      act(() => result.current.share.setFrozen(true));
      act(() => audio.playTo(900));
      act(() => result.current.share.setFrozen(false));
      expect(result.current.share.moment).toBe(895);
      expect(result.current.share.target(plain, "Hear it from")).toEqual(plain);
    });

    it("comes back unfrozen after the Episode leaves the player", async () => {
      visit("/episodes/4");
      const audio = new FakeAudio();
      const { player, result } = setup(createPlayer({ audio }));
      await act(() => player.play(episode));
      act(() => audio.playTo(759));
      act(() => result.current.share.setFrozen(true));
      act(() => player.close());
      expect(result.current.share.moment).toBeNull();
      await act(() => player.play(episode));
      expect(result.current.share.frozen).toBe(false);
    });
  });
});
