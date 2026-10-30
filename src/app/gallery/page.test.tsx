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

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<Gallery />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
