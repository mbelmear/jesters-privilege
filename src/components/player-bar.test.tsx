import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { content } from "@/content";
import { FakeAudio } from "@/lib/fake-audio";
import type { PlayableEpisode } from "@/lib/feed";
import { createPlayer } from "@/lib/player";
import { PlayerBar } from "./player-bar";
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

function setup() {
  const audio = new FakeAudio();
  const player = createPlayer({ audio });
  const result = render(
    <PlayerContext value={player}>
      <PlayerBar copy={content.shell.player} labels={content.episodePage} />
    </PlayerContext>
  );
  return { audio, player, user: userEvent.setup(), ...result };
}

// Starts the Episode and plays it to 12:34, as a listener would have.
async function playing(
  audio: FakeAudio,
  player: ReturnType<typeof createPlayer>
) {
  await act(() => player.play(episode));
  act(() => audio.playTo(754));
}

describe("PlayerBar", () => {
  it("stays hidden until an Episode is played", () => {
    setup();
    expect(screen.queryByRole("region", { name: "Player" })).toBeNull();
  });

  it("shows the playing Episode in a compact bar, with play and pause", async () => {
    const { audio, player, user } = setup();
    await playing(audio, player);
    const bar = screen.getByRole("region", { name: "Player" });
    expect(bar).toHaveTextContent("Is Humor a Virtue?");
    expect(
      screen.getByRole("button", { name: "Show player controls" })
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("slider")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(audio.playing).toBe(false);
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(audio.playing).toBe(true);
  });

  it("expands into the full controls", async () => {
    const { audio, player, user } = setup();
    await playing(audio, player);
    await user.click(
      screen.getByRole("button", { name: "Show player controls" })
    );
    expect(
      screen.getByRole("button", { name: "Hide player controls" })
    ).toHaveAttribute("aria-expanded", "true");

    const bar = screen.getByRole("region", { name: "Player" });
    expect(bar).toHaveTextContent("Episode 4");
    expect(
      screen.getByRole("link", { name: "Is Humor a Virtue?" })
    ).toHaveAttribute("href", "/episodes/4");
    expect(screen.getByRole("slider", { name: "Position" })).toHaveAttribute(
      "aria-valuetext",
      "12:34 of 42:57"
    );
    expect(bar).toHaveTextContent("Elapsed12:34");
    expect(bar).toHaveTextContent("Remaining−30:23");

    await user.click(screen.getByRole("button", { name: "Back 15 seconds" }));
    expect(audio.position).toBe(739);
    await user.click(
      screen.getByRole("button", { name: "Forward 30 seconds" })
    );
    expect(audio.position).toBe(769);

    fireEvent.change(screen.getByRole("slider", { name: "Position" }), {
      target: { value: "1200" },
    });
    expect(audio.position).toBe(1200);
  });

  it("steps through the playback speeds", async () => {
    const { audio, player, user } = setup();
    await playing(audio, player);
    await user.click(
      screen.getByRole("button", { name: "Show player controls" })
    );
    const speed = () => screen.getByRole("button", { name: /^Playback speed/ });
    expect(speed()).toHaveAccessibleName("Playback speed 1×");
    for (const next of ["1.25×", "1.5×", "2×", "1×"]) {
      await user.click(speed());
      expect(speed()).toHaveAccessibleName(`Playback speed ${next}`);
    }
    expect(audio.rate).toBe(1);
  });

  it("says when playback is waiting for the network", async () => {
    const { audio, player } = setup();
    await playing(audio, player);
    act(() => audio.stall());
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    act(() => audio.carryOn());
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("explains a failure, and carries on from there when Play is pressed", async () => {
    const { audio, player, user } = setup();
    await playing(audio, player);
    // Present and empty beforehand, so screen readers announce the message.
    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
    act(() => audio.fail());
    expect(screen.getByRole("alert")).toHaveTextContent(
      content.shell.player.failed.text
    );
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(audio.playing).toBe(true);
    expect(audio.position).toBe(754);
    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
  });

  it("has no accessibility violations, collapsed or expanded", async () => {
    const { audio, player, user, container } = setup();
    await playing(audio, player);
    expect(await axe(container)).toHaveNoViolations();
    await user.click(
      screen.getByRole("button", { name: "Show player controls" })
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
