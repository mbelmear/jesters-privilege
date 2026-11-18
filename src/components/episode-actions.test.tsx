import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { content } from "@/content";
import { FakeAudio } from "@/lib/fake-audio";
import type { PlayableEpisode } from "@/lib/feed";
import { createPlayer } from "@/lib/player";
import { EpisodeActions } from "./episode-actions";
import { PlayerContext } from "./player-provider";

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

const title = "Episode 4: Is Humor a Virtue?";
const copy = content.episodePage;

// Opens the page at an address, as a visitor following a link would.
function visit(path: string) {
  window.history.replaceState(null, "", path);
}

function setup() {
  const audio = new FakeAudio();
  const player = createPlayer({ audio });
  const shared: ShareData[] = [];
  Object.defineProperty(navigator, "share", {
    value: async (data: ShareData) => void shared.push(data),
    configurable: true,
  });
  const user = userEvent.setup();
  const result = render(
    <PlayerContext value={player}>
      <EpisodeActions
        episode={episode}
        name="Episode 4"
        title={title}
        path="/episodes/4"
        copy={copy}
        playerCopy={content.shell.player}
      />
    </PlayerContext>
  );
  return { audio, player, shared, user, ...result };
}

const startAt = () => screen.queryByRole("checkbox");

afterEach(() => visit("/"));

describe("EpisodeActions", () => {
  describe("sharing", () => {
    it("offers a moment only while this Episode is in the player", async () => {
      visit("/episodes/4");
      const { player } = setup();
      expect(startAt()).not.toBeInTheDocument();
      await act(() => player.play(another));
      expect(startAt()).not.toBeInTheDocument();
      await act(() => player.play(episode));
      expect(startAt()).toBeInTheDocument();
    });

    it("leaves the box unticked, its time following playback less a lead-in", async () => {
      visit("/episodes/4");
      const { audio, player } = setup();
      await act(() => player.play(episode));
      act(() => audio.playTo(759.6));
      expect(
        screen.getByRole("checkbox", { name: "Start at 12:34" })
      ).not.toBeChecked();
      act(() => audio.playTo(800));
      expect(
        screen.getByRole("checkbox", { name: "Start at 13:15" })
      ).toBeInTheDocument();
    });

    it("shares the whole Episode while the box is unticked", async () => {
      visit("/episodes/4");
      const { audio, player, shared, user } = setup();
      await act(() => player.play(episode));
      act(() => audio.playTo(759));
      await user.click(screen.getByRole("button", { name: "Share" }));
      expect(shared).toEqual([{ title, url: "http://localhost/episodes/4" }]);
    });

    it("shares a Moment link, frozen at the time ticked", async () => {
      visit("/episodes/4");
      const { audio, player, shared, user } = setup();
      await act(() => player.play(episode));
      act(() => audio.playTo(759));
      await user.click(
        screen.getByRole("checkbox", { name: "Start at 12:34" })
      );
      act(() => audio.playTo(900));
      expect(
        screen.getByRole("checkbox", { name: "Start at 12:34" })
      ).toBeChecked();
      await user.click(screen.getByRole("button", { name: "Share" }));
      expect(shared).toEqual([
        {
          title,
          url: "http://localhost/episodes/4?t=754",
          text: "Listen from 12:34",
        },
      ]);
    });

    it("follows playback again once unticked", async () => {
      visit("/episodes/4");
      const { audio, player, user } = setup();
      await act(() => player.play(episode));
      act(() => audio.playTo(759));
      const box = screen.getByRole("checkbox", { name: "Start at 12:34" });
      await user.click(box);
      act(() => audio.playTo(900));
      await user.click(box);
      expect(
        screen.getByRole("checkbox", { name: "Start at 14:55" })
      ).not.toBeChecked();
    });

    it("has no accessibility violations with the box shown", async () => {
      visit("/episodes/4");
      const { player, container } = setup();
      await act(() => player.play(episode));
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe("arriving on a Moment link", () => {
    it("loads the Episode paused at the moment, ready to play from it", async () => {
      visit("/episodes/4?t=754");
      const { audio, user } = setup();
      expect(audio.src).toBe(episode.audioUrl);
      expect(audio.playing).toBe(false);
      await user.click(
        screen.getByRole("button", { name: "Play from 12:34 Episode 4" })
      );
      expect(audio.playing).toBe(true);
      expect(audio.position).toBe(754);
      expect(
        screen.getByRole("button", { name: "Pause Episode 4" })
      ).toBeInTheDocument();
    });

    it("plays from the start, and says why, when the moment isn't in the Episode", async () => {
      visit("/episodes/4?t=9999");
      const { audio, user } = setup();
      expect(audio.src).toBeNull();
      expect(screen.getByText(copy.moment.bad.text)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Play Episode 4" }));
      expect(audio.position).toBe(0);
      expect(screen.queryByText(copy.moment.bad.text)).not.toBeInTheDocument();
    });

    it("has no accessibility violations on arrival", async () => {
      visit("/episodes/4?t=754");
      const { container } = setup();
      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no accessibility violations with a bad moment", async () => {
      visit("/episodes/4?t=abc");
      const { container } = setup();
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
