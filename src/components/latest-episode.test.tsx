import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { content } from "@/content";
import type { Episode } from "@/lib/feed";
import { LatestEpisode } from "./latest-episode";

const details = {
  guid: "https://api.spreaker.com/episode/4",
  title: "Is Humor a Virtue?",
  publishedAt: new Date("2027-01-14T12:00:00Z"),
  durationSeconds: 2577,
  audioUrl: "https://dts.podtrac.com/redirect.mp3/example.mp3",
  showNotesHtml: "<p>Aquinas on wit.</p>",
  excerpt: "Aquinas thought a good joke could be a virtue.",
  artworkUrl: "https://example.com/art.jpg",
  transcriptUrl: null,
};
const full: Episode = { ...details, type: "full", number: 4 };
const bonus: Episode = {
  ...details,
  type: "bonus",
  title: "Listener Confessions: Christmas Edition",
  slug: "listener-confessions-christmas-edition",
};

const renderLatest = (episode: Episode | undefined) =>
  render(
    <LatestEpisode
      episode={episode}
      copy={content.home.latestEpisode}
      comingSoon={content.microcopy.comingSoon}
    />
  );

describe("LatestEpisode", () => {
  it("features the newest Episode: number, title, date, length, excerpt", () => {
    renderLatest(full);
    const section = screen.getByRole("region", { name: "Latest Episode" });
    expect(section).toHaveTextContent(
      /^Latest EpisodeEpisode 4Is Humor a Virtue\?/
    );
    expect(
      screen.getByRole("heading", { name: "Is Humor a Virtue?" })
    ).toBeInTheDocument();
    expect(section).toHaveTextContent("Jan 14, 2027");
    expect(section).toHaveTextContent("43 min");
    expect(section).toHaveTextContent(
      "Aquinas thought a good joke could be a virtue."
    );
  });

  it("leads to the Episode's page", () => {
    renderLatest(full);
    expect(
      screen.getByRole("link", { name: "Is Humor a Virtue?" })
    ).toHaveAttribute("href", "/episodes/4");
    expect(
      screen.getByRole("link", { name: "Play Episode 4" })
    ).toHaveAttribute("href", "/episodes/4");
  });

  it("labels a bonus Episode in place of a number", () => {
    renderLatest(bonus);
    expect(screen.getByRole("region")).toHaveTextContent(
      /^Latest EpisodeBonus/
    );
    expect(
      screen.getByRole("link", {
        name: "Play Listener Confessions: Christmas Edition",
      })
    ).toHaveAttribute(
      "href",
      "/episodes/bonus/listener-confessions-christmas-edition"
    );
  });

  it("says Episode 1 is on its way before any is published", () => {
    renderLatest(undefined);
    expect(screen.getByRole("region")).toHaveTextContent(
      content.microcopy.comingSoon.text
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it.each([
    ["an Episode", full],
    ["none yet", undefined],
  ])("has no detectable accessibility violations with %s", async (_, ep) => {
    const { container } = renderLatest(ep);
    expect(await axe(container)).toHaveNoViolations();
  });
});
