import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { content } from "@/content";
import { FakeAudio } from "@/lib/fake-audio";
import type { PlayableEpisode } from "@/lib/feed";
import { createPlayer, PLAYER_STORAGE_KEY } from "@/lib/player";
import { PlayEpisodeButton } from "./play-episode-button";
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

// A device that heard the first 12 minutes 34 seconds of the Episode.
function partlyHeard() {
  const saved = JSON.stringify({
    positions: { [episode.guid]: 754 },
    finished: [],
    lastPlayed: episode.guid,
  });
  return {
    getItem: (key: string) => (key === PLAYER_STORAGE_KEY ? saved : null),
    setItem: () => {},
  };
}

function setup({
  storage = null,
}: { storage?: ReturnType<typeof partlyHeard> | null } = {}) {
  const audio = new FakeAudio();
  const player = createPlayer({ audio, storage });
  const result = render(
    <PlayerContext value={player}>
      <PlayEpisodeButton
        episode={episode}
        name="Episode 4"
        copy={content.shell.player}
      />
    </PlayerContext>
  );
  return { audio, player, user: userEvent.setup(), ...result };
}

describe("PlayEpisodeButton", () => {
  it("starts the Episode in the player, then pauses it", async () => {
    const { audio, player, user } = setup();
    await user.click(screen.getByRole("button", { name: "Play Episode 4" }));
    expect(audio.src).toBe("https://example.com/ep-4.mp3");
    expect(player.getState().mode).toBe("playing");

    await user.click(screen.getByRole("button", { name: "Pause Episode 4" }));
    expect(player.getState().mode).toBe("paused");
    expect(
      screen.getByRole("button", { name: "Resume Episode 4" })
    ).toBeInTheDocument();
  });

  it("offers to resume a partly heard Episode where it was left", async () => {
    const { audio, user } = setup({ storage: partlyHeard() });
    await user.click(
      screen.getByRole("button", { name: "Resume from 12:34 Episode 4" })
    );
    expect(audio.position).toBe(754);
    expect(audio.playing).toBe(true);
  });

  it("starts a partly heard Episode over when asked", async () => {
    const { audio, user } = setup({ storage: partlyHeard() });
    await user.click(
      screen.getByRole("button", { name: "Start over Episode 4" })
    );
    expect(audio.position).toBe(0);
    expect(audio.playing).toBe(true);
  });

  it("offers Play before the player is ready, as in the page's HTML", () => {
    render(
      <PlayEpisodeButton
        episode={episode}
        name="Episode 4"
        copy={content.shell.player}
      />
    );
    expect(
      screen.getByRole("button", { name: "Play Episode 4" })
    ).toBeInTheDocument();
  });

  it("has no accessibility violations while offering to resume", async () => {
    const { container } = setup({ storage: partlyHeard() });
    expect(await axe(container)).toHaveNoViolations();
  });
});
