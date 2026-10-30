import { glyphsBeyondLatin, subsetText, unicodeRange } from "./fonts";

describe("glyphsBeyondLatin", () => {
  it("finds the letters outside Google's latin subset, each once, in code point order", () => {
    expect(
      glyphsBeyondLatin([
        "Stańczyk",
        "Velázquez – “Las Meninas”",
        "Dvořák",
        "Stańczyk",
      ])
    ).toBe("ńř");
  });

  it("finds nothing in plain English with typographic punctuation", () => {
    expect(
      glyphsBeyondLatin(["He’s choosing not to take it personally… — €5™"])
    ).toBe("");
  });

  it("keeps a character beyond the Basic Multilingual Plane whole", () => {
    expect(glyphsBeyondLatin(["Jest 🃏"])).toBe("🃏");
  });
});

describe("subsetText", () => {
  it("holds the latin subset plus the glyphs given, and nothing more", () => {
    const text = subsetText("ń");

    expect([...text]).toEqual(
      expect.arrayContaining([..."Stańczyk, Velázquez – “Las Meninas”"])
    );
    expect(glyphsBeyondLatin([text])).toBe("ń");
    expect([...text]).toHaveLength(387 + 1);
  });
});

describe("unicodeRange", () => {
  it("writes code points as a CSS unicode-range, joining runs, in order, each once", () => {
    expect(unicodeRange([0x144, 0x41, 0x42, 0x43, 0x1f0cf, 0x2013, 0x42])).toBe(
      "U+41-43, U+144, U+2013, U+1F0CF"
    );
  });
});
