import { momentLabel, momentLink, parseMoment, sharedMoment } from "./moment";

describe("parseMoment", () => {
  const duration = 2577;

  it("finds no moment in an address without t", () => {
    expect(parseMoment("", duration)).toEqual({ kind: "none" });
    expect(parseMoment("?utm_source=x", duration)).toEqual({ kind: "none" });
  });

  it("reads a whole number of seconds within the Episode", () => {
    expect(parseMoment("?t=754", duration)).toEqual({
      kind: "moment",
      seconds: 754,
    });
  });

  it("reads exactly 0 as the start", () => {
    expect(parseMoment("?t=0", duration)).toEqual({
      kind: "moment",
      seconds: 0,
    });
  });

  it.each(["?t=", "?t=abc", "?t=12.5", "?t=-3", "?t=1e3", "?t= 5", "?t=12:34"])(
    "calls %s a bad moment",
    (search) => {
      expect(parseMoment(search, duration)).toEqual({ kind: "bad" });
    }
  );

  it("calls a moment at or past the Episode's end bad", () => {
    expect(parseMoment("?t=2577", duration)).toEqual({ kind: "bad" });
    expect(parseMoment("?t=9999", duration)).toEqual({ kind: "bad" });
    expect(parseMoment("?t=2576", duration)).toEqual({
      kind: "moment",
      seconds: 2576,
    });
  });
});

describe("sharedMoment", () => {
  it("starts five seconds before the player's position, to the second", () => {
    expect(sharedMoment(759.9, null)).toBe(754);
  });

  it("never starts before 0", () => {
    expect(sharedMoment(3, null)).toBe(0);
  });

  it("keeps a frozen moment however far playback moves", () => {
    expect(sharedMoment(1500, 754)).toBe(754);
  });
});

describe("momentLink", () => {
  it("adds the moment to the Episode's address", () => {
    expect(momentLink("https://example.com/episodes/4", 754)).toBe(
      "https://example.com/episodes/4?t=754"
    );
  });
});

describe("momentLabel", () => {
  it("reads the moment after its phrase", () => {
    expect(momentLabel("Start at", 754)).toBe("Start at 12:34");
    expect(momentLabel("Start at", 3754)).toBe("Start at 1:02:34");
  });
});
