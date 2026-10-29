import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { shell } from "@/content/shell";
import { SiteHeader } from "./site-header";

beforeAll(() => {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
});

const mainNav = () => screen.getByRole("navigation", { name: "Main" });

describe("SiteHeader", () => {
  it("links the logo home", () => {
    render(<SiteHeader shell={shell} episodeCount={3} />);
    const home = screen.getByRole("link", { name: "Jester's Privilege, home" });
    expect(home).toHaveAttribute("href", "/");
    expect(within(home).getByRole("img")).toBeInTheDocument();
  });

  it("lists every main section once Episodes are published", () => {
    render(<SiteHeader shell={shell} episodeCount={3} />);
    const links = within(mainNav()).getAllByRole("link");
    expect(
      links.map((link) => [link.textContent, link.getAttribute("href")])
    ).toEqual([
      ["Episodes", "/episodes"],
      ["Fools' Gallery", "/gallery"],
      ["About", "/about"],
      ["Submit", "/submit"],
    ]);
  });

  it("leaves Episodes out while none are published", () => {
    render(<SiteHeader shell={shell} episodeCount={0} />);
    expect(
      within(mainNav())
        .getAllByRole("link")
        .map((link) => link.textContent)
    ).toEqual(["Fools' Gallery", "About", "Submit"]);
  });

  it("offers the theme toggle and the mobile menu", () => {
    render(<SiteHeader shell={shell} episodeCount={3} />);
    expect(
      screen.getByRole("button", { name: "Dark theme" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<SiteHeader shell={shell} episodeCount={3} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
