import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import Styleguide from "./page";

beforeAll(() => {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
});

const panel = (name: string) => screen.getByRole("region", { name });

describe("Style guide", () => {
  it("is titled as the style guide", () => {
    render(<Styleguide />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Style guide" })
    ).toBeInTheDocument();
  });

  it("offers the theme toggle", () => {
    render(<Styleguide />);
    expect(
      screen.getByRole("button", { name: "Dark theme" })
    ).toBeInTheDocument();
  });

  it.each(["Light theme", "Dark theme"])(
    "shows every color token, typeface, and component in the %s panel",
    (name) => {
      render(<Styleguide />);
      const specimen = within(panel(name));

      for (const token of [
        "background",
        "foreground",
        "primary",
        "brand",
        "brand-display",
        "brand-ink",
        "destructive",
      ]) {
        expect(specimen.getByText(token, { selector: "code" })).toBeVisible();
      }
      for (const typeface of [
        "Gloock",
        "Source Serif 4",
        "Barlow Semi Condensed",
      ]) {
        expect(
          specimen.getByRole("heading", { name: typeface })
        ).toBeInTheDocument();
      }
      for (const component of [
        "Buttons",
        "Toggle",
        "Checkbox",
        "Select",
        "Dialog",
        "Menu",
      ]) {
        expect(
          specimen.getByRole("heading", { name: component })
        ).toBeInTheDocument();
      }
      expect(specimen.getByText("processional")).toBeInTheDocument();
      expect(specimen.getByText("courtly")).toBeInTheDocument();
    }
  );

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<Styleguide />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
