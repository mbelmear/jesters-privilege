import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { content } from "@/content";
import { FakeAudio } from "@/lib/fake-audio";
import type { PlayableEpisode } from "@/lib/feed";
import { createPlayer } from "@/lib/player";
import type { Transcript } from "@/lib/transcript";
import { EpisodeTranscript } from "./episode-transcript";
import { PlayerContext } from "./player-provider";

const episode: PlayableEpisode = {
  type: "full",
  number: 1,
  guid: "https://api.spreaker.com/episode/1",
  title: "Celebrity Pastors",
  durationSeconds: 2580,
  audioUrl: "https://example.com/ep-1.mp3",
  artworkUrl: "https://example.com/art.jpg",
};

const another: PlayableEpisode = {
  ...episode,
  number: 2,
  guid: "https://api.spreaker.com/episode/2",
  title: "The Holy Fool",
  audioUrl: "https://example.com/ep-2.mp3",
};

const transcript: Transcript = [
  { startSeconds: 8.457, text: "Welcome to Jester's Privilege." },
  { startSeconds: 20.949, text: "Celebrity pastors." },
  { startSeconds: 245, text: "So who gets to call himself a pastor?" },
  { startSeconds: 3725, text: "That's the Episode. Go in peace." },
];

function setup() {
  const audio = new FakeAudio();
  const player = createPlayer({ audio });
  const result = render(
    <PlayerContext value={player}>
      <EpisodeTranscript
        episode={episode}
        transcript={transcript}
        copy={content.episodePage.transcript}
      />
    </PlayerContext>
  );
  return { audio, player, user: userEvent.setup(), ...result };
}

describe("EpisodeTranscript", () => {
  it("starts the Episode from a paragraph's timestamp", async () => {
    const { audio, user } = setup();
    await user.click(screen.getByRole("button", { name: "Play from 0:20" }));
    expect(audio.src).toBe("https://example.com/ep-1.mp3");
    expect(audio.position).toBeCloseTo(20.949);
    expect(audio.playing).toBe(true);
  });

  it("switches to this Episode from one that's playing", async () => {
    const { audio, player, user } = setup();
    await act(() => player.play(another));
    await user.click(screen.getByRole("button", { name: "Play from 0:20" }));
    expect(audio.src).toBe("https://example.com/ep-1.mp3");
    expect(audio.position).toBeCloseTo(20.949);
    expect(audio.playing).toBe(true);
  });

  it("marks the paragraph being spoken as the Episode plays", async () => {
    const { audio, user } = setup();
    expect(paragraph("Celebrity pastors.")).not.toHaveAttribute("aria-current");
    await user.click(screen.getByRole("button", { name: "Play from 0:20" }));
    expect(paragraph("Celebrity pastors.")).toHaveAttribute(
      "aria-current",
      "true"
    );
    act(() => audio.seek(250));
    expect(paragraph("Celebrity pastors.")).not.toHaveAttribute("aria-current");
    expect(paragraph("So who gets to call himself a pastor?")).toHaveAttribute(
      "aria-current",
      "true"
    );
  });

  it("marks no paragraph while another Episode plays", async () => {
    const { audio, player } = setup();
    await act(() => player.play(another));
    act(() => audio.seek(250));
    for (const { text } of transcript) {
      expect(paragraph(text)).not.toHaveAttribute("aria-current");
    }
  });

  it("opens collapsed to a preview, though every paragraph is on the page", () => {
    setup();
    for (const { text } of transcript) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    // Past the preview, nothing shows or takes focus until the reader opens it.
    expect(paragraph("Celebrity pastors.")).toBeVisible();
    expect(
      paragraph("So who gets to call himself a pastor?")
    ).not.toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Play from 4:05" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Read the full transcript" })
    ).toBeInTheDocument();
  });

  it("opens in full, taking the reader to where the preview ended", async () => {
    const { user } = setup();
    await user.click(
      screen.getByRole("button", { name: "Read the full transcript" })
    );
    for (const { text } of transcript) {
      expect(paragraph(text)).toBeVisible();
    }
    expect(
      screen.queryByRole("button", { name: "Read the full transcript" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Play from 4:05" })
    ).toHaveFocus();
  });

  it("shows a Transcript no longer than the preview in full", () => {
    render(
      <PlayerContext value={null}>
        <EpisodeTranscript
          episode={episode}
          transcript={transcript.slice(0, 2)}
          copy={content.episodePage.transcript}
        />
      </PlayerContext>
    );
    expect(paragraph("Celebrity pastors.")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Read the full transcript" })
    ).not.toBeInTheDocument();
  });

  it("is headed Transcript, with a note that a machine wrote it", async () => {
    const { container } = setup();
    const section = screen.getByRole("region", { name: "Transcript" });
    expect(section).toHaveTextContent(/A machine wrote this down/);
    expect(await axe(container)).toHaveNoViolations();
  });
});

// The paragraph holding these words, timestamp and all.
const paragraph = (text: string) =>
  screen.getByText(text).closest("[data-paragraph]");
