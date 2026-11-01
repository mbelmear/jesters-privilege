import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { content } from "@/content";
import type { Jester, Site } from "@/lib/content";
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

  it("explains why a jester, then the Jesters, belief, church, and listening, in that order", () => {
    render(<About />);
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)
    ).toEqual([
      "Why a jester?",
      "The Jesters",
      "What we believe",
      "Redeemer Church, Bozeman",
      "How to listen",
    ]);
    expect(screen.getByText(/1 Corinthians 4:10/)).toBeVisible();
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
      /^M?Michael BelmearCo-host$/
    );
  });

  it("shows every Jester's headshot", () => {
    render(<About />);
    expect(screen.getByRole("img", { name: /^Michael Belmear/ })).toBeVisible();
    expect(screen.getByRole("img", { name: /^Dan Collins/ })).toBeVisible();
    expect(screen.getByRole("img", { name: /^Aaron Canen/ })).toBeVisible();
  });

  it("marks its draft copy with the DRAFT ribbon on a preview", () => {
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
