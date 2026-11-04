import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { listen } from "@/content/listen";
import { shell } from "@/content/shell";
import type { Site } from "@/lib/content";
import { SiteFooter } from "./site-footer";

const bare: Site = {
  name: "Jester's Privilege",
  tagline: "Theology in the Motley.",
  description: { text: "A weekly theology-and-humor podcast." },
  url: "https://jestersprivilegepodcast.com",
  contactEmail: "hello@jestersprivilegepodcast.com",
  listen: {},
  social: {},
};

const everyLink: Site = {
  ...bare,
  listen: {
    "apple-podcasts": "https://podcasts.apple.com/us/podcast/show/id1",
    spotify: "https://open.spotify.com/show/1",
    "amazon-music": "https://music.amazon.com/podcasts/1/show",
    youtube: "https://www.youtube.com/@show",
    rss: "https://www.spreaker.com/show/1/episodes/feed",
  },
  social: {
    instagram: "https://www.instagram.com/show/",
    linkedin: "https://www.linkedin.com/company/show",
    facebook: "https://www.facebook.com/show",
    tiktok: "https://www.tiktok.com/@show",
    x: "https://x.com/show",
  },
};

function renderFooter(site: Site = bare, episodeCount = 1) {
  return render(
    <SiteFooter
      site={site}
      shell={shell}
      platforms={listen.platforms}
      episodeCount={episodeCount}
      year={2026}
    />
  );
}

const footer = () => screen.getByRole("contentinfo");
const part = (name: string) =>
  within(footer()).getByRole("navigation", { name });
const links = (element: HTMLElement) =>
  within(element)
    .getAllByRole("link")
    .map((link) => [link.textContent, link.getAttribute("href")]);

describe("SiteFooter", () => {
  it("opens with the site's one-line description", () => {
    renderFooter();
    expect(footer()).toHaveTextContent(bare.description.text);
  });

  it("maps the site's sections under Explore", () => {
    renderFooter();
    expect(links(part("Explore"))).toEqual(
      shell.nav.map(({ label, href }) => [label, href])
    );
  });

  it("leaves Episodes out of Explore until there are Episodes", () => {
    renderFooter(bare, 0);
    expect(links(part("Explore"))).toEqual(
      shell.nav
        .filter((item) => !("onlyWithEpisodes" in item))
        .map(({ label, href }) => [label, href])
    );
  });

  it("shows each Listen link and social link as an icon with a hidden name", () => {
    renderFooter(everyLink);
    expect(links(part("Listen"))).toEqual([
      ["Apple Podcasts", everyLink.listen["apple-podcasts"]],
      ["Spotify", everyLink.listen.spotify],
      ["Amazon Music", everyLink.listen["amazon-music"]],
      ["YouTube", everyLink.listen.youtube],
      ["RSS", everyLink.listen.rss],
    ]);
    expect(links(part("Follow"))).toEqual([
      ["Instagram", everyLink.social.instagram],
      ["LinkedIn", everyLink.social.linkedin],
      ["Facebook", everyLink.social.facebook],
      ["TikTok", everyLink.social.tiktok],
      ["X", everyLink.social.x],
    ]);
    for (const name of ["Listen", "Follow"]) {
      for (const link of within(part(name)).getAllByRole("link")) {
        expect(link.querySelector("svg[aria-hidden='true']")).not.toBeNull();
        expect(link.querySelector(".sr-only")).toHaveTextContent(
          link.textContent ?? ""
        );
      }
    }
  });

  it("shows only the links that are set", () => {
    renderFooter({
      ...bare,
      listen: { spotify: "https://open.spotify.com/show/1" },
      social: { linkedin: "https://www.linkedin.com/company/show" },
    });
    expect(links(part("Listen"))).toEqual([
      ["Spotify", "https://open.spotify.com/show/1"],
    ]);
    expect(links(part("Follow"))).toEqual([
      ["LinkedIn", "https://www.linkedin.com/company/show"],
    ]);
  });

  it("leaves out Listen and Follow until they have a link", () => {
    renderFooter();
    expect(
      within(footer()).queryByRole("navigation", { name: "Listen" })
    ).not.toBeInTheDocument();
    expect(
      within(footer()).queryByRole("navigation", { name: "Follow" })
    ).not.toBeInTheDocument();
  });

  it("ends with the contact email, privacy note, copyright, and ESV notice", () => {
    renderFooter();
    expect(
      within(footer()).getByRole("link", {
        name: "hello@jestersprivilegepodcast.com",
      })
    ).toHaveAttribute("href", "mailto:hello@jestersprivilegepodcast.com");
    expect(footer()).toHaveTextContent(shell.footer.privacyNote.text);
    expect(footer()).toHaveTextContent("© 2026 Jester's Privilege");
    expect(footer()).toHaveTextContent(shell.footer.esvNotice.text);
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = renderFooter(everyLink);
    expect(await axe(container)).toHaveNoViolations();
  });
});
