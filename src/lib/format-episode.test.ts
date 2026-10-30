import type { Episode } from "./feed";
import {
  episodeLabel,
  formatListeningTime,
  formatPublishDate,
} from "./format-episode";

describe("formatPublishDate", () => {
  it("names the day an Episode was published, as the feed dates it", () => {
    expect(formatPublishDate(new Date("2027-01-14T12:00:00Z"))).toBe(
      "Jan 14, 2027"
    );
  });

  it("keeps the feed's calendar day wherever the build runs", () => {
    expect(formatPublishDate(new Date("2026-12-24T23:30:00Z"))).toBe(
      "Dec 24, 2026"
    );
  });
});

const units = { hours: "hr", minutes: "min" };

describe("formatListeningTime", () => {
  it("rounds to whole minutes", () => {
    expect(formatListeningTime(2577, units)).toBe("43 min");
  });

  it("gives hours and minutes for a long Episode", () => {
    expect(formatListeningTime(3900, units)).toBe("1 hr 5 min");
  });

  it("gives hours alone on the hour", () => {
    expect(formatListeningTime(7200, units)).toBe("2 hr");
  });

  it("never shows a short clip as no time at all", () => {
    expect(formatListeningTime(20, units)).toBe("1 min");
  });
});

describe("episodeLabel", () => {
  const details = {
    guid: "https://api.spreaker.com/episode/4",
    title: "Is Humor a Virtue?",
    publishedAt: new Date("2027-01-14T12:00:00Z"),
    durationSeconds: 2577,
    audioUrl: "https://dts.podtrac.com/redirect.mp3/example.mp3",
    showNotesHtml: "<p>Aquinas on wit.</p>",
    excerpt: "Aquinas on wit.",
    artworkUrl: "https://example.com/art.jpg",
    transcriptUrl: null,
  };
  const labels = { episode: "Episode", bonus: "Bonus", trailer: "Trailer" };
  const episode = (fields: Partial<Episode>): Episode =>
    ({ ...details, type: "full", number: 4, ...fields }) as Episode;

  it("numbers a full Episode", () => {
    expect(episodeLabel(episode({}), labels)).toEqual({
      kind: "numbered",
      number: 4,
      text: "Episode 4",
    });
  });

  it("labels bonus and trailer Episodes in place of a number", () => {
    const bonus = episode({ type: "bonus", slug: "a-bonus" });
    const trailer = episode({ type: "trailer", slug: "a-trailer" });
    expect(episodeLabel(bonus, labels)).toEqual({
      kind: "labelled",
      text: "Bonus",
    });
    expect(episodeLabel(trailer, labels)).toEqual({
      kind: "labelled",
      text: "Trailer",
    });
  });
});
