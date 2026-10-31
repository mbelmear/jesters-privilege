import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { content } from "@/content";
import { FakeAudio } from "@/lib/fake-audio";
import type { PlayableEpisode } from "@/lib/feed";
import { createPlayer, PLAYER_STORAGE_KEY } from "@/lib/player";
import { PlayerDock } from "./player-dock";
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

// A device that left Episode 4 at 12:34 on an earlier visit.
function partlyHeard() {
  const saved = JSON.stringify({
    positions: { [episode.guid]: 754 },
    finished: [],
    lastPlayed: episode,
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
      <PlayerDock copy={content.shell.player} labels={content.episodePage} />
    </PlayerContext>
  );
  return { audio, player, user: userEvent.setup(), ...result };
}

describe("PlayerDock", () => {
  it("shows the player bar once an Episode is played", async () => {
    const { player } = setup();
    expect(screen.queryByRole("region", { name: "Player" })).toBeNull();
    await act(() => player.play(episode));
    expect(
      await screen.findByRole("region", { name: "Player" })
    ).toHaveTextContent("Is Humor a Virtue?");
  });

  it("offers to resume the Episode left partly heard on an earlier visit", async () => {
    const { audio, user } = setup({ storage: partlyHeard() });
    const offer = await screen.findByRole("region", { name: "Player" });
    expect(offer).toHaveTextContent("Episode 4");
    expect(offer).toHaveTextContent("Is Humor a Virtue?");

    await user.click(
      screen.getByRole("button", { name: "Resume from 12:34 Episode 4" })
    );
    expect(audio.src).toBe("https://example.com/ep-4.mp3");
    expect(audio.position).toBe(754);
    expect(
      await screen.findByRole("button", { name: "Pause" })
    ).toBeInTheDocument();
  });

  it("puts the offer away for this visit when declined", async () => {
    const { user } = setup({ storage: partlyHeard() });
    await user.click(await screen.findByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("region", { name: "Player" })).toBeNull();
  });

  it("has no accessibility violations while offering to resume", async () => {
    const { container } = setup({ storage: partlyHeard() });
    await screen.findByRole("region", { name: "Player" });
    expect(await axe(container)).toHaveNoViolations();
  });
});
