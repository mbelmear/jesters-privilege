import { act, render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { content } from "@/content";
import { EPISODE_LISTEN_APPS } from "@/lib/episode-listen-links";
import Home from "./page";

beforeAll(() => {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
});

// The fixture's Apple lookup doesn't list its newest Episode yet, so every
// render logs that its Apple Podcasts link opens the show.
let warn: jest.SpyInstance;
beforeEach(() => {
  warn = jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

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

  it("has no Listen on row: the hero leads straight into the latest Episode", async () => {
    await renderHome();
    expect(
      screen.queryByRole("region", { name: "Listen on" })
    ).not.toBeInTheDocument();
  });

  it("offers the latest Episode in each app the show is on, the show where an app doesn't list it yet", async () => {
    await renderHome();
    const apps = within(
      screen.getByRole("region", { name: "Latest Episode" })
    ).getByRole("list", { name: "or listen on" });
    expect(
      within(apps)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href"))
    ).toEqual(
      // Every app the show is on opens the show: the fixture's Apple lookup
      // doesn't list this Episode, and a fixture build doesn't ask Spotify.
      EPISODE_LISTEN_APPS.flatMap((app) => content.site.listen[app] ?? [])
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Apple Podcasts doesn't list "Is Humor a Virtue\?"/
      )
    );
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
