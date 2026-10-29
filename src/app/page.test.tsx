import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import Home from "./page";

describe("Home", () => {
  it("shows a top-level heading", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<Home />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
