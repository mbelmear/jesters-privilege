import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import NotFound from "./not-found";

describe("NotFound", () => {
  it("tells the visitor they've wandered from the court", () => {
    render(<NotFound />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "You've wandered from the court",
      })
    ).toBeInTheDocument();
  });

  it("offers a way home", () => {
    render(<NotFound />);
    expect(
      screen.getByRole("link", { name: "Return to the court" })
    ).toHaveAttribute("href", "/");
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<NotFound />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
