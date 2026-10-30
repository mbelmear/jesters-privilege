// Google Fonts' "latin" subset, as code point ranges: what every self-hosted
// font file carries before the glyphs the content adds (scripts/fonts.ts).
// Copied from the unicode-range next/font/google gives its latin faces.
export const LATIN: readonly (readonly [number, number])[] = [
  [0x0000, 0x00ff],
  [0x0131, 0x0131],
  [0x0152, 0x0153],
  [0x02bb, 0x02bc],
  [0x02c6, 0x02c6],
  [0x02da, 0x02da],
  [0x02dc, 0x02dc],
  [0x0304, 0x0304],
  [0x0308, 0x0308],
  [0x0329, 0x0329],
  [0x2000, 0x206f],
  [0x20ac, 0x20ac],
  [0x2122, 0x2122],
  [0x2191, 0x2191],
  [0x2193, 0x2193],
  [0x2212, 0x2212],
  [0x2215, 0x2215],
  [0xfeff, 0xfeff],
  [0xfffd, 0xfffd],
];

function isLatin(codePoint: number): boolean {
  return LATIN.some(([first, last]) => codePoint >= first && codePoint <= last);
}

// The characters in the text that Google's latin subset lacks, such as the ń
// of Stańczyk: each once, in code point order.
export function glyphsBeyondLatin(texts: Iterable<string>): string {
  const found = new Set<number>();
  for (const text of texts) {
    for (const codePoint of codePoints(text)) {
      if (!isLatin(codePoint)) found.add(codePoint);
    }
  }
  return String.fromCodePoint(...[...found].sort((a, b) => a - b));
}

// The text's code points, counting a character beyond the Basic Multilingual
// Plane, such as an emoji, as one.
export function codePoints(text: string): number[] {
  return [...text].flatMap((char) => char.codePointAt(0) ?? []);
}

// Every character a font subset keeps: the latin subset plus the glyphs given.
export function subsetText(glyphs: string): string {
  const latin = LATIN.flatMap(([first, last]) =>
    Array.from({ length: last - first + 1 }, (_, i) => first + i)
  );
  return String.fromCodePoint(...latin) + glyphs;
}

// Code points as a CSS unicode-range, such as "U+41-43, U+144": what a split
// face declares so the browser fetches it only for the letters it holds.
export function unicodeRange(codePoints: Iterable<number>): string {
  const sorted = [...new Set(codePoints)].sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (const codePoint of sorted) {
    const last = runs.at(-1);
    if (last && codePoint === last[1] + 1) last[1] = codePoint;
    else runs.push([codePoint, codePoint]);
  }
  const hex = (codePoint: number) => codePoint.toString(16).toUpperCase();
  return runs
    .map(([first, last]) =>
      first === last ? `U+${hex(first)}` : `U+${hex(first)}-${hex(last)}`
    )
    .join(", ");
}
