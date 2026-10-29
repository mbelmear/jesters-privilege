import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import Home from "./page";

describe("Home", () => {
  it("names the show in its top-level heading", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Jester's Privilege" })
    ).toBeInTheDocument();
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<Home />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
