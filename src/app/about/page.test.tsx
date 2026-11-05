import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { content } from "@/content";
import type { Copy, Jester, Site } from "@/lib/content";
import About, { metadata } from "./page";

describe("About", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("offers the platforms the show is on under How to listen", () => {
    const listen: Site["listen"] = {
      spotify: "https://open.spotify.com/show/jesters-privilege",
    };
    jest.replaceProperty(content.site, "listen", listen);
    render(<About />);
    const howToListen = within(
      screen.getByRole("region", { name: "How to listen" })
    );
    expect(howToListen.getByRole("link", { name: /Spotify/ })).toHaveAttribute(
      "href",
      "https://open.spotify.com/show/jesters-privilege"
    );
  });

  it("names the page in its top-level heading and the tab", () => {
    render(<About />);
    expect(
      screen.getByRole("heading", { level: 1, name: "About" })
    ).toBeInTheDocument();
    expect(metadata.title).toBe("About");
  });

  it("explains the show's name, then the Jesters, belief, and listening, in that order", () => {
    render(<About />);
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)
    ).toEqual([
      content.about.whyAJester.title,
      "The Jesters",
      "What we believe",
      "How to listen",
    ]);
    expect(screen.getByText(/1 Corinthians 4:10/)).toBeVisible();
  });

  // The elders' request on #6: the show reads as its Jesters' own.
  it("closes the show's name by saying the show is the Jesters' own", () => {
    render(<About />);
    const why = screen.getByRole("region", {
      name: content.about.whyAJester.title,
    });
    const paragraphs = within(why)
      .getAllByRole("paragraph")
      .map((p) => p.textContent);
    expect(paragraphs.at(-2)).toMatch(/^So we take up the jester's place\./);
    expect(paragraphs.at(-1)).toMatch(/our own project/);
  });

  it("introduces the three Jesters in their order, each with role and full bio", () => {
    render(<About />);
    const jesters = within(screen.getByRole("region", { name: "The Jesters" }));
    expect(
      jesters.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)
    ).toEqual(["Michael Belmear", "Dan Collins", "Aaron Canen"]);
    expect(jesters.getAllByText("Co-host")).toHaveLength(2);
    expect(jesters.getByText("Producer & Co-host")).toBeVisible();
    expect(
      jesters.getByText(/^Aaron is the one who makes the rest of us sound good/)
    ).toHaveTextContent(/If a joke didn't make the episode, Aaron cut it\./);
    // Show titles are set in italics, as the Jesters wrote them.
    expect(jesters.getByText("The Perfect Lens").tagName).toBe("EM");
    expect(jesters.getByText("Polemical").tagName).toBe("EM");
  });

  it("shows a Jester's name and role alone, under the shield, until their photo and bio arrive", () => {
    const newcomer: Jester = {
      id: "michael",
      name: "Michael Belmear",
      role: "Co-host",
    };
    jest.replaceProperty<{ jesters: readonly Jester[] }, "jesters">(
      content,
      "jesters",
      [newcomer]
    );
    render(<About />);
    const jesters = screen.getByRole("region", { name: "The Jesters" });
    expect(within(jesters).queryByRole("img")).not.toBeInTheDocument();
    expect(within(jesters).getByRole("listitem")).toHaveTextContent(
      // The shield bears his initial; the name and role follow it, and no bio.
      /^MMichael BelmearCo-host$/
    );
  });

  it("shows every Jester's headshot", () => {
    render(<About />);
    expect(screen.getByRole("img", { name: /^Michael Belmear/ })).toBeVisible();
    expect(screen.getByRole("img", { name: /^Dan Collins/ })).toBeVisible();
    expect(screen.getByRole("img", { name: /^Aaron Canen/ })).toBeVisible();
  });

  // Its own draft, so the test holds whatever the Jesters have approved.
  it("marks draft copy with the DRAFT ribbon on a preview", () => {
    jest.replaceProperty<{ intro: Copy }, "intro">(content.about, "intro", {
      ...content.about.intro,
      draft: true,
    });
    const before = process.env.SITE_ENV;
    process.env.SITE_ENV = "preview";
    try {
      render(<About />);
      expect(screen.getByRole("note")).toHaveTextContent("Draft");
    } finally {
      if (before === undefined) delete process.env.SITE_ENV;
      else process.env.SITE_ENV = before;
    }
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<About />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
