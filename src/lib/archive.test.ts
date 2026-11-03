import { archiveOf } from "./archive";
import type { Episode } from "./feed";

function episode(title: string, publishedAt: string, number?: number): Episode {
  const details = {
    guid: `guid-${title}`,
    title,
    publishedAt: new Date(publishedAt),
    durationSeconds: 2400,
    audioUrl: `https://example.com/${title}.mp3`,
    showNotesHtml: "<p>Notes</p>",
    excerpt: "Notes",
    artworkUrl: "https://example.com/art.jpg",
    transcriptUrl: null,
  };
  return number === undefined
    ? { ...details, type: "bonus", slug: title.toLowerCase() }
    : { ...details, type: "full", number };
}

describe("archiveOf", () => {
  it("has nothing to show before Episode 1 is published", () => {
    expect(archiveOf([])).toBeUndefined();
  });

  it("features the newest Episode and groups the rest under their years, newest first", () => {
    const four = episode("Four", "2027-01-14T12:00:00Z", 4);
    const bonus = episode("Christmas", "2026-12-24T12:00:00Z");
    const three = episode("Three", "2026-12-03T12:00:00Z", 3);
    const two = episode("Two", "2027-01-07T12:00:00Z", 2);
    const archive = archiveOf([four, two, bonus, three]);
    expect(archive?.latest).toBe(four);
    expect(archive?.years).toEqual([
      { year: 2027, episodes: [two] },
      { year: 2026, episodes: [bonus, three] },
    ]);
  });

  it("dates an Episode to its year in the feed's time zone, UTC", () => {
    const latest = episode("Latest", "2027-02-01T12:00:00Z", 3);
    // 8 pm on New Year's Eve in Montana is already 2027 in UTC.
    const newYear = episode("New Year", "2027-01-01T03:00:00Z", 2);
    const eve = episode("Eve", "2026-12-31T23:30:00Z", 1);
    expect(archiveOf([latest, newYear, eve])?.years).toEqual([
      { year: 2027, episodes: [newYear] },
      { year: 2026, episodes: [eve] },
    ]);
  });

  it("lists no years when the newest Episode is the only one", () => {
    const one = episode("One", "2026-11-12T12:00:00Z", 1);
    expect(archiveOf([one])).toEqual({ latest: one, years: [] });
  });
});
