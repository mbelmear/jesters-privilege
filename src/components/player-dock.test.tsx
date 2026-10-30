import { act, render, screen } from "@testing-library/react";
import { content } from "@/content";
import { FakeAudio } from "@/lib/fake-audio";
import { createPlayer } from "@/lib/player";
import { PlayerDock } from "./player-dock";
import { PlayerContext } from "./player-provider";

describe("PlayerDock", () => {
  it("shows the player bar once an Episode is played", async () => {
    const player = createPlayer({ audio: new FakeAudio() });
    render(
      <PlayerContext value={player}>
        <PlayerDock copy={content.shell.player} labels={content.episodePage} />
      </PlayerContext>
    );
    expect(screen.queryByRole("region", { name: "Player" })).toBeNull();
    await act(() =>
      player.play({
        type: "full",
        number: 4,
        guid: "https://api.spreaker.com/episode/4",
        title: "Is Humor a Virtue?",
        durationSeconds: 2577,
        audioUrl: "https://example.com/ep-4.mp3",
        artworkUrl: "https://example.com/art.jpg",
      })
    );
    expect(
      await screen.findByRole("region", { name: "Player" })
    ).toHaveTextContent("Is Humor a Virtue?");
  });
});
