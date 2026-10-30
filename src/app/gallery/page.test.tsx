import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
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

  it("marks its draft copy with the DRAFT ribbon on a preview", () => {
    // DraftRibbon reads SITE_ENV as it loads, so the page loads afresh.
    const before = process.env.SITE_ENV;
    process.env.SITE_ENV = "preview";
    try {
      jest.isolateModules(() => {
        const { default: PreviewGallery }: { default: typeof Gallery } =
          jest.requireActual("./page");
        render(<PreviewGallery />);
      });
      expect(screen.getByRole("note")).toHaveTextContent("Draft");
    } finally {
      process.env.SITE_ENV = before;
    }
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<Gallery />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
