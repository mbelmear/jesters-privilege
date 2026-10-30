import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { shell } from "@/content/shell";
import type { Site } from "@/lib/content";
import { SiteFooter } from "./site-footer";

const bare: Site = {
  name: "Jester's Privilege",
  tagline: "Theology in the Motley.",
  description: { text: "A weekly theology-and-humor podcast." },
  contactEmail: "hello@jestersprivilegepodcast.com",
  listen: {},
  social: {},
};

const footer = () => screen.getByRole("contentinfo");

describe("SiteFooter", () => {
  it("gives the contact email, privacy note, and copyright", () => {
    render(
      <SiteFooter
        site={bare}
        copy={shell.footer}
        logo={shell.logo}
        year={2026}
      />
    );
    expect(
      within(footer()).getByRole("link", {
        name: "hello@jestersprivilegepodcast.com",
      })
    ).toHaveAttribute("href", "mailto:hello@jestersprivilegepodcast.com");
    expect(footer()).toHaveTextContent(shell.footer.privacyNote.text);
    expect(footer()).toHaveTextContent("© 2026 Jester's Privilege");
  });

  it("shows only the social links that are set", () => {
    render(
      <SiteFooter
        site={{
          ...bare,
          social: { instagram: "https://www.instagram.com/jestersprivilege" },
        }}
        copy={shell.footer}
        logo={shell.logo}
        year={2026}
      />
    );
    const social = screen.getByRole("list", { name: "Follow the show" });
    expect(
      within(social)
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")])
    ).toEqual([["Instagram", "https://www.instagram.com/jestersprivilege"]]);
  });

  it("leaves out the social list and RSS link until they exist", () => {
    render(
      <SiteFooter
        site={bare}
        copy={shell.footer}
        logo={shell.logo}
        year={2026}
      />
    );
    expect(
      screen.queryByRole("list", { name: "Follow the show" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "RSS feed" })
    ).not.toBeInTheDocument();
  });

  it("links the RSS feed once it exists", () => {
    render(
      <SiteFooter
        site={{
          ...bare,
          listen: { rss: "https://www.spreaker.com/show/1/episodes/feed" },
        }}
        copy={shell.footer}
        logo={shell.logo}
        year={2026}
      />
    );
    expect(screen.getByRole("link", { name: "RSS feed" })).toHaveAttribute(
      "href",
      "https://www.spreaker.com/show/1/episodes/feed"
    );
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(
      <SiteFooter
        site={{
          ...bare,
          listen: { rss: "https://www.spreaker.com/show/1/episodes/feed" },
          social: { instagram: "https://www.instagram.com/jestersprivilege" },
        }}
        copy={shell.footer}
        logo={shell.logo}
        year={2026}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
