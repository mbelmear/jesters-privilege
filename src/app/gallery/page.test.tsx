import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { content } from "@/content";
import type { Copy } from "@/lib/content";
import Gallery, { metadata } from "./page";

describe("Gallery", () => {
  it("names the Fools' Gallery in its top-level heading and the tab", () => {
    render(<Gallery />);
    expect(
      screen.getByRole("heading", { level: 1, name: "The Fools' Gallery" })
    ).toBeInTheDocument();
    expect(metadata.title).toBe("The Fools' Gallery");
  });

  it("introduces the history before the first era", () => {
    render(<Gallery />);
    expect(
      screen.getByText(/^For as long as there have been kings/)
    ).toBeVisible();
  });

  // Its own draft, so the test holds whatever the Jesters have approved.
  it("marks draft copy with the DRAFT ribbon on a preview", () => {
    jest.replaceProperty<{ intro: Copy }, "intro">(content.gallery, "intro", {
      ...content.gallery.intro,
      draft: true,
    });
    const before = process.env.SITE_ENV;
    process.env.SITE_ENV = "preview";
    try {
      render(<Gallery />);
      expect(screen.getByRole("note")).toHaveTextContent("Draft");
    } finally {
      if (before === undefined) delete process.env.SITE_ENV;
      else process.env.SITE_ENV = before;
    }
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<Gallery />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
