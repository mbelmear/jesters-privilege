import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { content } from "@/content";
import { EpisodeListenLinks } from "@/components/episode-listen-links";

const links = [
  {
    app: "apple-podcasts",
    href: "https://podcasts.apple.com/us/podcast/celebrity-pastors/id6830338936?i=1000799664710",
  },
  {
    app: "spotify",
    href: "https://open.spotify.com/show/6a7KnKe6ohzrMGZwJDc5Ti",
  },
  {
    app: "amazon-music",
    href: "https://music.amazon.com/podcasts/581f57eb-1503-4a04-b10d-5431bb5029b9/jesters-privilege",
  },
] as const;

describe("EpisodeListenLinks", () => {
  it("offers the Episode in each app, in alphabetical order, named for a screen reader", () => {
    render(<EpisodeListenLinks links={links} copy={content.listen} />);
    const list = screen.getByRole("list", { name: "or listen on" });
    expect(list).toBeVisible();
    expect(
      screen
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")])
    ).toEqual([
      ["Amazon Music", links[2].href],
      ["Apple Podcasts", links[0].href],
      ["Spotify", links[1].href],
    ]);
  });

  it("shows nothing before the show is on any app", () => {
    const { container } = render(
      <EpisodeListenLinks links={[]} copy={content.listen} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(
      <EpisodeListenLinks links={links} copy={content.listen} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
