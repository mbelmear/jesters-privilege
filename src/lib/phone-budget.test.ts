import { heaviestOverPhoneBudget } from "./phone-budget";

describe("heaviestOverPhoneBudget", () => {
  const avif = (url: string, width: number) => ({
    url,
    format: "avif" as const,
    width,
  });
  const crop = { left: 0, top: 0, width: 800, height: 1000 };

  it("passes a painting whose phone files are all within 180 KB", () => {
    expect(
      heaviestOverPhoneBudget([
        { variant: avif("/images/p/1200.avif", 1200), bytes: 180_000 },
      ])
    ).toBeUndefined();
  });

  it("names the heaviest AVIF a phone would download past 180 KB", () => {
    const portrait = { ...avif("/images/p/portrait-1600.avif", 800), crop };
    expect(
      heaviestOverPhoneBudget([
        { variant: avif("/images/p/1200.avif", 1200), bytes: 184_000 },
        { variant: portrait, bytes: 279_000 },
      ])
    ).toEqual({ variant: portrait, bytes: 279_000 });
  });

  it("leaves out WebP and the widths only wider screens download", () => {
    expect(
      heaviestOverPhoneBudget([
        {
          variant: { url: "/images/p/1200.webp", format: "webp", width: 1200 },
          bytes: 400_000,
        },
        { variant: avif("/images/p/1600.avif", 1600), bytes: 400_000 },
      ])
    ).toBeUndefined();
  });
});
