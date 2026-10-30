import { formatListeningTime, formatPublishDate } from "./format-episode";

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
