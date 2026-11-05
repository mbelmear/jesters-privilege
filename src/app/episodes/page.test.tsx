import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { content } from "@/content";
import type { Copy } from "@/lib/content";
import type { ReactNode } from "react";
import { PlayerContext } from "@/components/player-provider";
import { getEpisodes } from "@/content/feed";
import { FakeAudio } from "@/lib/fake-audio";
import { createPlayer, PLAYER_STORAGE_KEY } from "@/lib/player";
import Episodes, { metadata } from "./page";

// The real Feed (the fixture), which a test can swap for an empty one.
jest.mock("@/content/feed", () => {
  const actual =
    jest.requireActual<typeof import("@/content/feed")>("@/content/feed");
  return { ...actual, getEpisodes: jest.fn(actual.getEpisodes) };
});

// The page reads the Feed: the fixture, whose newest Episode is Episode 4
// (January 2027) and whose others were all published in 2026.
async function renderEpisodes(wrap = (page: ReactNode) => page) {
  return render(wrap(await Episodes()));
}

const year = (name: string) => screen.getByRole("region", { name });
const rows = (name: string) =>
  within(year(name))
    .getAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);

describe("Episodes", () => {
  it("names the archive in its top-level heading and the tab", async () => {
    await renderEpisodes();
    expect(
      screen.getByRole("heading", { level: 1, name: "Episodes" })
    ).toBeInTheDocument();
    expect(metadata.title).toBe("Episodes");
  });

  it("features the newest Episode as the latest", async () => {
    await renderEpisodes();
    expect(
      screen.getByRole("region", { name: "Latest Episode" })
    ).toHaveTextContent("Is Humor a Virtue?");
  });

  it("lists every other Episode under its year, newest first", async () => {
    await renderEpisodes();
    expect(screen.queryByRole("region", { name: "2027" })).toBeNull();
    expect(rows("2026")).toEqual([
      "Listener Confessions: Christmas Edition",
      "Mockery and the Prophets",
      "The Holy Fool",
      "Celebrity Pastors",
      "Introducing Jester's Privilege - Trailer",
    ]);
  });

  it("numbers full Episodes and labels bonus and trailer Episodes", async () => {
    await renderEpisodes();
    const items = within(year("2026")).getAllByRole("listitem");
    expect(items.map((item) => item.firstChild?.textContent)).toEqual([
      "Bonus",
      "Episode 3",
      "Episode 2",
      "Episode 1",
      "Trailer",
    ]);
  });

  it("shows each row's date, length, and excerpt", async () => {
    await renderEpisodes();
    const [, three] = within(year("2026")).getAllByRole("listitem");
    expect(three).toHaveTextContent("Dec 3, 2026");
    expect(three).toHaveTextContent(/\d+ min/);
    const [episode3] = (await getEpisodes()).filter(
      (episode) => episode.type === "full" && episode.number === 3
    );
    expect(three).toHaveTextContent(episode3.excerpt);
  });

  it("links each row to its Episode page", async () => {
    await renderEpisodes();
    const region = year("2026");
    expect(
      within(region).getByRole("link", { name: "Mockery and the Prophets" })
    ).toHaveAttribute("href", "/episodes/3");
    expect(
      within(region).getByRole("link", {
        name: "Listener Confessions: Christmas Edition",
      })
    ).toHaveAttribute(
      "href",
      "/episodes/bonus/listener-confessions-christmas-edition"
    );
  });

  it("plays any row's Episode in place", async () => {
    await renderEpisodes();
    const region = year("2026");
    expect(
      within(region).getByRole("button", { name: "Play Episode 2" })
    ).toBeInTheDocument();
    expect(
      within(region).getByRole("button", {
        name: "Play Listener Confessions: Christmas Edition",
      })
    ).toBeInTheDocument();
  });

  it("marks the Episodes heard to the end on this device", async () => {
    const [two] = (await getEpisodes()).filter(
      (episode) => episode.type === "full" && episode.number === 2
    );
    const saved = JSON.stringify({
      positions: {},
      finished: [two.guid],
      lastPlayed: two.guid,
    });
    const player = createPlayer({
      audio: new FakeAudio(),
      storage: {
        getItem: (key) => (key === PLAYER_STORAGE_KEY ? saved : null),
        setItem: () => {},
      },
    });
    await renderEpisodes((page) => (
      <PlayerContext value={player}>{page}</PlayerContext>
    ));
    const items = within(year("2026")).getAllByRole("listitem");
    expect(
      items.map((item) => within(item).queryByText("Finished") !== null)
    ).toEqual([false, false, true, false, false]);
    expect(
      within(
        screen.getByRole("region", { name: "Latest Episode" })
      ).queryByText("Finished")
    ).toBeNull();
  });

  it("marks the featured Episode once it's heard to the end", async () => {
    const [latest] = await getEpisodes();
    const saved = JSON.stringify({
      positions: {},
      finished: [latest.guid],
      lastPlayed: latest.guid,
    });
    const player = createPlayer({
      audio: new FakeAudio(),
      storage: {
        getItem: (key) => (key === PLAYER_STORAGE_KEY ? saved : null),
        setItem: () => {},
      },
    });
    await renderEpisodes((page) => (
      <PlayerContext value={player}>{page}</PlayerContext>
    ));
    expect(
      within(screen.getByRole("region", { name: "Latest Episode" })).getByText(
        "Finished"
      )
    ).toBeInTheDocument();
  });

  // Its own draft, so the test holds whatever the Jesters have approved.
  it("marks draft copy with the DRAFT ribbon on a preview", async () => {
    jest.replaceProperty<{ intro: Copy }, "intro">(content.episodes, "intro", {
      ...content.episodes.intro,
      draft: true,
    });
    const before = process.env.SITE_ENV;
    process.env.SITE_ENV = "preview";
    try {
      await renderEpisodes();
      expect(screen.getByRole("note")).toHaveTextContent("Draft");
    } finally {
      if (before === undefined) delete process.env.SITE_ENV;
      else process.env.SITE_ENV = before;
    }
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = await renderEpisodes();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Episodes when the Feed comes back empty", () => {
  it("says the Episodes have wandered off, with no Episodes listed", async () => {
    jest.mocked(getEpisodes).mockResolvedValueOnce([]);
    await renderEpisodes();
    expect(
      screen.getByText(/^Our Episodes have wandered off/)
    ).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).toBeNull();
  });
});
