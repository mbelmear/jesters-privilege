import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { content } from "@/content";
import type { Jester } from "@/lib/content";
import { MeetTheJesters } from "./meet-the-jesters";

const copy = { title: "Meet the Jesters", link: "More about the Jesters" };

const renderStrip = (jesters: readonly Jester[] = content.jesters) =>
  render(<MeetTheJesters jesters={jesters} copy={copy} aboutHref="/about" />);

describe("MeetTheJesters", () => {
  it("introduces each Jester by name, role, and summary, in order", () => {
    renderStrip();
    const section = screen.getByRole("region", { name: "Meet the Jesters" });
    const items = within(section).getAllByRole("listitem");
    expect(
      items.map((item) => within(item).getByRole("heading").textContent)
    ).toEqual(["Michael Belmear", "Dan Collins", "Aaron Canen"]);
    expect(items[2]).toHaveTextContent("Producer & Co-host");
    expect(items[1]).toHaveTextContent(
      /discipleship pastor and father of five/
    );
  });

  it("shows the photos that exist and a shield for the rest", () => {
    renderStrip();
    expect(
      screen.getAllByRole("img").map((img) => img.getAttribute("alt"))
    ).toEqual([
      expect.stringMatching(/^Dan Collins/),
      expect.stringMatching(/^Aaron Canen/),
    ]);
  });

  it("shows name and role alone for a Jester without a summary", () => {
    renderStrip([{ id: "dan", name: "Dan Collins", role: "Co-host" }]);
    expect(screen.getByRole("listitem")).toHaveTextContent(
      /^D?Dan CollinsCo-host$/
    );
  });

  it("links to the Jesters' full bios on About", () => {
    renderStrip();
    expect(
      screen.getByRole("link", { name: "More about the Jesters" })
    ).toHaveAttribute("href", "/about");
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = renderStrip();
    expect(await axe(container)).toHaveNoViolations();
  });
});
