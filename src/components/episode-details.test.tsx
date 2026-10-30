import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { content } from "@/content";
import { findEpisode, parseFeed } from "@/lib/feed";
import { EpisodeDetails } from "./episode-details";

const episodes = parseFeed(
  readFileSync(join(process.cwd(), "src/content/feed-fixture.xml"), "utf8")
);

function renderEpisode(address: string[]) {
  const sequence = findEpisode(episodes, address);
  if (!sequence) throw new Error(`The fixture has no Episode at ${address}`);
  return render(
    <EpisodeDetails
      sequence={sequence}
      copy={content.episodePage}
      playerCopy={content.shell.player}
    />
  );
}

const sequenceNav = () =>
  screen.getByRole("navigation", { name: "More Episodes" });

describe("EpisodeDetails", () => {
  it("heads the page with the Episode's number, title, date, and length", () => {
    renderEpisode(["2"]);
    expect(
      screen.getByRole("heading", { level: 1, name: "The Holy Fool" })
    ).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Nov 19, 2026")).toHaveAttribute(
      "datetime",
      "2026-11-19"
    );
    expect(screen.getByText("38 min")).toBeInTheDocument();
  });

  it("labels a bonus Episode in place of a number", () => {
    renderEpisode(["bonus", "listener-confessions-christmas-edition"]);
    expect(screen.getByRole("article")).toHaveTextContent(
      /^BonusListener Confessions: Christmas Edition/
    );
  });

  it("offers to play the Episode and to share it", () => {
    renderEpisode(["2"]);
    expect(
      screen.getByRole("button", { name: "Play Episode 2" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
  });

  it("shows the Show notes with their links and line breaks intact", () => {
    renderEpisode(["1"]);
    const notes = screen.getByRole("region", { name: "Show notes" });
    expect(notes).toHaveTextContent(/^Show notesEvery court needs a Fool/);
    expect(
      within(notes).getByRole("link", { name: "Follow us on Instagram." })
    ).toHaveAttribute("href", "https://www.instagram.com/jestersprivilege/");
    expect(notes.querySelectorAll("br")).toHaveLength(4);
  });

  it("links to the Episodes published before and after", () => {
    renderEpisode(["2"]);
    expect(
      within(sequenceNav()).getByRole("link", {
        name: "Previous Episode Celebrity Pastors",
      })
    ).toHaveAttribute("href", "/episodes/1");
    expect(
      within(sequenceNav()).getByRole("link", {
        name: "Next Episode Mockery and the Prophets",
      })
    ).toHaveAttribute("href", "/episodes/3");
  });

  it("links only forward from the first Episode and only back from the latest", () => {
    const first = renderEpisode([
      "bonus",
      "introducing-jesters-privilege-trailer",
    ]);
    expect(within(sequenceNav()).getAllByRole("link")).toHaveLength(1);
    expect(within(sequenceNav()).getByRole("link")).toHaveAccessibleName(
      "Next Episode Celebrity Pastors"
    );
    first.unmount();

    renderEpisode(["4"]);
    expect(within(sequenceNav()).getAllByRole("link")).toHaveLength(1);
    expect(within(sequenceNav()).getByRole("link")).toHaveAccessibleName(
      "Previous Episode Listener Confessions: Christmas Edition"
    );
  });

  it.each([
    ["a full Episode", ["4"]],
    ["a trailer", ["bonus", "introducing-jesters-privilege-trailer"]],
  ])(
    "has no detectable accessibility violations for %s",
    async (_, address) => {
      const { container } = renderEpisode(address);
      expect(await axe(container)).toHaveNoViolations();
    }
  );
});
