import { formatDuration } from "./format-duration";

describe("formatDuration", () => {
  it("shows minutes and seconds for an Episode under an hour", () => {
    expect(formatDuration(754)).toBe("12:34");
  });

  it("adds hours and pads minutes for an Episode of an hour or more", () => {
    expect(formatDuration(3725)).toBe("1:02:05");
  });

  it("drops fractions of a second, as reported by the audio element", () => {
    expect(formatDuration(59.9)).toBe("0:59");
  });
});
