import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { content } from "@/content";
import type { Site } from "@/lib/content";
import { ListenButtons } from "./listen-buttons";

const all: Site["listen"] = {
  "apple-podcasts": "https://podcasts.apple.com/us/podcast/id1",
  spotify: "https://open.spotify.com/show/abc",
  youtube: "https://www.youtube.com/@jestersprivilege",
  rss: "https://www.spreaker.com/show/1/episodes/feed",
};

const renderButtons = (links: Site["listen"]) =>
  render(
    <ListenButtons
      links={links}
      copy={content.home.listen}
      newToPodcasts={content.microcopy.newToPodcasts}
    />
  );

describe("ListenButtons", () => {
  it("links to every platform the show is on, in a fixed order", () => {
    renderButtons(all);
    expect(
      screen
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")])
    ).toEqual([
      ["Apple Podcasts", all["apple-podcasts"]],
      ["Spotify", all.spotify],
      ["YouTube", all.youtube],
      ["RSS", all.rss],
    ]);
  });

  it("hides each button until its link exists", () => {
    renderButtons({ spotify: all.spotify });
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(
      ["Spotify"]
    );
  });

  it("explains podcasts to a visitor who has never used them", () => {
    renderButtons({ spotify: all.spotify });
    expect(screen.getByText(/^New to podcasts\?/)).toBeInTheDocument();
  });

  it("shows nothing before the show is on any platform", () => {
    const { container } = renderButtons({});
    expect(container).toBeEmptyDOMElement();
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = renderButtons(all);
    expect(await axe(container)).toHaveNoViolations();
  });
});
