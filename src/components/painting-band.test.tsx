import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { paintings } from "@/content/paintings";
import { PaintingBand } from "./painting-band";

const painting = paintings.stanczyk;

describe("PaintingBand", () => {
  it("sets its short title over the painting", () => {
    render(<PaintingBand painting={painting} title="The Renaissance" />);
    expect(
      screen.getByRole("heading", { level: 2, name: "The Renaissance" })
    ).toBeVisible();
    expect(screen.getByRole("img", { name: painting.alt })).toBeVisible();
  });

  it("credits the painting with its placard", () => {
    render(<PaintingBand painting={painting} title="The Renaissance" />);
    const figure = screen.getByRole("figure");
    expect(within(figure).getByText("Jan Matejko")).toBeVisible();
    expect(within(figure).getByText("National Museum in Warsaw")).toBeVisible();
  });

  it("shows phones the portrait crop around the focal point", () => {
    const { container } = render(
      <PaintingBand painting={painting} title="The Renaissance" />
    );
    const phone = container.querySelector(
      'source[media="(width < 48rem)"][type="image/avif"]'
    );
    expect(phone?.getAttribute("srcset")).toContain(
      "/images/paintings/stanczyk/portrait-828.avif 828w"
    );
  });

  it("keeps the focal point in view as wider screens crop the band", () => {
    render(<PaintingBand painting={painting} title="The Renaissance" />);
    expect(screen.getByRole("img")).toHaveStyle({ objectPosition: "52% 30%" });
  });

  it("loads lazily unless it's the largest paint", () => {
    const { rerender } = render(
      <PaintingBand painting={painting} title="The Renaissance" />
    );
    expect(screen.getByRole("img")).toHaveAttribute("loading", "lazy");
    rerender(
      <PaintingBand
        painting={painting}
        title="The Renaissance"
        loading="largest-paint"
      />
    );
    expect(screen.getByRole("img")).toHaveAttribute("loading", "eager");
    expect(screen.getByRole("img")).toHaveAttribute("fetchpriority", "high");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <PaintingBand painting={painting} title="The Renaissance" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
