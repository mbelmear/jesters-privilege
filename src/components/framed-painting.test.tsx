import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { paintings } from "@/content/paintings";
import { FramedPainting } from "./framed-painting";

const painting = paintings["pablo-de-valladolid"];

describe("FramedPainting", () => {
  it("shows the painting, described by its alt text", () => {
    render(<FramedPainting painting={painting} />);
    expect(screen.getByRole("img", { name: painting.alt })).toBeVisible();
  });

  it("labels it with a museum placard from the painting's content", () => {
    render(<FramedPainting painting={painting} />);
    const figure = screen.getByRole("figure");
    for (const field of [
      "Diego Velázquez",
      "Pablo de Valladolid",
      "c. 1635",
      "Oil on canvas",
      "Museo del Prado, Madrid",
    ]) {
      expect(within(figure).getByText(field, { exact: false })).toBeVisible();
    }
  });

  it("offers the build's AVIF and WebP files", () => {
    const { container } = render(<FramedPainting painting={painting} />);
    expect(
      container
        .querySelector('source[type="image/avif"]')
        ?.getAttribute("srcset")
    ).toContain("/images/paintings/pablo-de-valladolid/828.avif 828w");
    expect(screen.getByRole("img").getAttribute("srcset")).toContain(
      "/images/paintings/pablo-de-valladolid/828.webp 828w"
    );
  });

  it("loads lazily unless it's the largest paint", () => {
    const { rerender } = render(<FramedPainting painting={painting} />);
    expect(screen.getByRole("img")).toHaveAttribute("loading", "lazy");
    rerender(<FramedPainting painting={painting} loading="largest-paint" />);
    expect(screen.getByRole("img")).toHaveAttribute("loading", "eager");
    expect(screen.getByRole("img")).toHaveAttribute("fetchpriority", "high");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<FramedPainting painting={painting} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
