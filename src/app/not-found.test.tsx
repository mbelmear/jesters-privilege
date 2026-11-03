import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { microcopy } from "@/content/microcopy";
import NotFound from "./not-found";

describe("NotFound", () => {
  it("tells the visitor the page they wanted isn't here", () => {
    render(<NotFound />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: microcopy.notFoundTitle.text,
      })
    ).toBeInTheDocument();
  });

  it("offers a way home", () => {
    render(<NotFound />);
    expect(
      screen.getByRole("link", { name: microcopy.notFoundLink.text })
    ).toHaveAttribute("href", "/");
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<NotFound />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
