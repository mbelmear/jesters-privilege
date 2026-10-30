import { act, render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { content } from "@/content";
import Home from "./page";

beforeAll(() => {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
});

// The page reads the Feed (the fixture), and its story's MotionProvider loads
// Motion's features in the background; let that land inside act.
async function renderHome() {
  const view = render(await Home());
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  return view;
}

describe("Home", () => {
  it("names the show in its top-level heading", async () => {
    await renderHome();
    expect(
      screen.getByRole("heading", { level: 1, name: "Jester's Privilege" })
    ).toBeInTheDocument();
  });

  it("tells the jester story", async () => {
    await renderHome();
    expect(
      screen.getByText(/^Long ago, in the great halls of Europe/)
    ).toBeInTheDocument();
    expect(screen.getByText("This is Jester's Privilege.")).toBeInTheDocument();
  });

  it("features the newest Episode in the Feed", async () => {
    await renderHome();
    expect(
      screen.getByRole("region", { name: "Latest Episode" })
    ).toHaveTextContent("Is Humor a Virtue?");
  });

  it("links only to the platforms the show is on", async () => {
    await renderHome();
    const section = screen.queryByRole("region", { name: "Listen on" });
    const hrefs = section
      ? within(section)
          .getAllByRole("link")
          .map((link) => link.getAttribute("href"))
      : [];
    expect(hrefs.sort()).toEqual(Object.values(content.site.listen).sort());
  });

  it("leads to the Fools' Gallery and About at their addresses in the navigation", async () => {
    await renderHome();
    expect(
      screen.getByRole("link", { name: "Enter the Fools' Gallery" })
    ).toHaveAttribute("href", "/gallery");
    expect(
      screen.getByRole("link", { name: "More about the Jesters" })
    ).toHaveAttribute("href", "/about");
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = await renderHome();
    expect(await axe(container)).toHaveNoViolations();
  });
});
