import { act, render, screen, within } from "@testing-library/react";
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

// The motion specimens' MotionProvider loads Motion's features in the
// background and then updates LazyMotion; let that land inside act, so React
// doesn't warn about an update outside it.
async function renderStyleguide() {
  const view = render(<Styleguide />);
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  return view;
}

describe("Style guide", () => {
  it("is titled as the style guide", async () => {
    await renderStyleguide();
    expect(
      screen.getByRole("heading", { level: 1, name: "Style guide" })
    ).toBeInTheDocument();
  });

  it.each(["Light theme", "Dark theme"])(
    "shows every color token, typeface, and component in the %s panel",
    async (name) => {
      await renderStyleguide();
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
    const { container } = await renderStyleguide();
    expect(await axe(container)).toHaveNoViolations();
  });
});
