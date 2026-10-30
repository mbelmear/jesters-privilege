// Makes the self-hosted fonts (#57). Each face is split in two, as Google
// Fonts splits a family into subsets:
//
// - src/fonts/<face>.woff2: Google's latin subset plus the glyphs the content
//   uses beyond it, such as the ń of Stańczyk, so a page that names a Fool
//   fetches no second file before its first paint;
// - src/fonts/<face>-rest.woff2: every other glyph the typeface has, fetched
//   only on a page that shows one, such as a letter in an episode title from
//   the feed.
//
// Each half declares the unicode-range it covers, so the browser picks the
// file by the letters on the page. Both halves share one family: a second
// family stacked behind the first (Google's, say) gets fetched while the first
// is still loading, which cost 17.5 KB before first paint when measured (#57). next/font reads only literal options, so
// this writes the font definitions in src/app/fonts.ts, plus
// src/fonts/glyphs.json for the content test to check the subsets against.
// Run it after adding text with a new accented letter; that test says when.
// Usage: npm run fonts
//
// The sources are the families' upstream files at a fixed commit of
// google/fonts, so the output changes only when the content or this does.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format, resolveConfig } from "prettier";
import subsetFont from "subset-font";
import { contentGlyphsBeyondLatin } from "@/content/glyphs";
import { codePoints, subsetText, unicodeRange } from "@/lib/fonts";

const OUT = path.join("src", "fonts");
const DEFINITIONS = path.join("src", "app", "fonts.ts");
const SOURCE =
  "https://raw.githubusercontent.com/google/fonts/6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec/ofl/";

// Source Serif 4's optical-size axis is pinned at its default, as Google
// serves it when only weight is asked for: the axis more than doubles the file.
type VariationAxes = Record<string, number | { min: number; max: number }>;
const SOURCE_SERIF_AXES: VariationAxes = {
  opsz: 20,
  wght: { min: 200, max: 900 },
};

type FaceSpec = {
  // The constant src/app/fonts.ts exports, and the CSS family name, unless
  // `family` joins the face to another's family.
  name: string;
  family?: "sourceSerif" | "barlowSemiCondensed";
  file: string;
  source: string;
  weight: string;
  style: "normal" | "italic";
  variationAxes?: VariationAxes;
  // The CSS variable the font tokens in globals.css read.
  variable: string;
  // The local font next/font sizes to match while the face loads.
  fallback: "Times New Roman" | "Arial" | false;
  preload: boolean;
  doc: string;
};

// Together the faces a page fetches before its first paint must fit the font
// budget in lighthouserc.json.
const FACES: FaceSpec[] = [
  {
    name: "gloock",
    file: "gloock",
    source: "gloock/Gloock-Regular.ttf",
    weight: "400",
    style: "normal",
    variable: "--font-gloock",
    fallback: "Times New Roman",
    preload: true,
    doc: "Display: headlines, decree-style titles, the drop cap.",
  },
  {
    name: "sourceSerif",
    file: "source-serif-4",
    source: "sourceserif4/SourceSerif4[opsz,wght].ttf",
    weight: "200 900",
    style: "normal",
    variationAxes: SOURCE_SERIF_AXES,
    variable: "--font-source-serif",
    fallback: "Times New Roman",
    preload: true,
    doc: "Body: reading text, preloaded because it's usually the largest paint. Variable weight.",
  },
  {
    name: "sourceSerifItalic",
    family: "sourceSerif",
    file: "source-serif-4-italic",
    source: "sourceserif4/SourceSerif4-Italic[opsz,wght].ttf",
    weight: "200 900",
    style: "italic",
    variationAxes: SOURCE_SERIF_AXES,
    variable: "--font-source-serif-italic",
    fallback: false,
    preload: false,
    doc: "The body italic, not preloaded, so only pages that use it download it. It joins the upright's family, so `font-body` covers both.",
  },
  {
    name: "barlowSemiCondensed",
    file: "barlow-semi-condensed-500",
    source: "barlowsemicondensed/BarlowSemiCondensed-Medium.ttf",
    weight: "500",
    style: "normal",
    variable: "--font-barlow-semi-condensed",
    fallback: "Arial",
    preload: false,
    doc: "UI: navigation, buttons, labels, metadata. Not preloaded: it's small text, where swapping in late is harmless, and preloading it delays the first paint of the headline and body.",
  },
  {
    name: "barlowSemiCondensed600",
    family: "barlowSemiCondensed",
    file: "barlow-semi-condensed-600",
    source: "barlowsemicondensed/BarlowSemiCondensed-SemiBold.ttf",
    weight: "600",
    style: "normal",
    variable: "--font-barlow-semi-condensed-600",
    fallback: false,
    preload: false,
    doc: "The UI face's heavier weight, in the same family.",
  },
];

// The OpenType features Latin text uses by default, plus tabular figures for
// times and counts. Keeping every feature (small caps, swashes, alternates)
// costs more than the hinting, which is dropped too, as Google does.
const FEATURES = [
  "ccmp",
  "locl",
  "mark",
  "mkmk",
  "kern",
  "liga",
  "clig",
  "calt",
  "rlig",
  "rvrn",
  "dist",
  "frac",
  "numr",
  "dnom",
  "tnum",
];

type Half = { file: string; codePoints: number[] };

async function split(spec: FaceSpec, subset: Set<number>): Promise<Half[]> {
  const response = await fetch(SOURCE + encodeURI(spec.source));
  if (!response.ok) {
    throw new Error(
      `${spec.source}: ${response.status} ${response.statusText}`
    );
  }
  const font = Buffer.from(await response.arrayBuffer());
  // harfbuzzjs awaits its WebAssembly at the top level, so it can't be
  // required the way tsx loads this script.
  const { Blob, Face } = await import("harfbuzzjs");
  const all = [...new Face(new Blob(font), 0).collectUnicodes()];
  const halves = [
    { file: spec.file, codePoints: all.filter((cp) => subset.has(cp)) },
    {
      file: `${spec.file}-rest`,
      codePoints: all.filter((cp) => !subset.has(cp)),
    },
  ];

  for (const { file, codePoints } of halves) {
    const woff2 = await subsetFont(font, String.fromCodePoint(...codePoints), {
      targetFormat: "woff2",
      variationAxes: spec.variationAxes,
      noHinting: true,
      keepFeatures: FEATURES,
    });
    await writeFile(path.join(OUT, `${file}.woff2`), woff2);
    console.log(`${file}.woff2: ${(woff2.length / 1024).toFixed(1)} KB`);
  }
  return halves;
}

function definition(
  spec: FaceSpec,
  half: Half,
  rest: boolean
): { name: string; code: string } {
  const name = rest ? `${spec.name}Rest` : spec.name;
  const declarations = [
    ...(rest || spec.family
      ? [{ prop: "font-family", value: spec.family ?? spec.name }]
      : []),
    { prop: "unicode-range", value: unicodeRange(half.codePoints) },
  ];
  const options = {
    src: `../fonts/${half.file}.woff2`,
    weight: spec.weight,
    style: spec.style,
    variable: rest ? `${spec.variable}-rest` : spec.variable,
    adjustFontFallback: rest ? false : spec.fallback,
    preload: rest ? false : spec.preload,
    declarations,
  };
  const doc = rest
    ? `/** The rest of ${spec.name}'s glyphs, fetched only for a letter the subset lacks. */`
    : `/** ${spec.doc} */`;
  const exported = rest ? "" : "export ";
  return {
    name,
    code: `${doc}\n${exported}const ${name} = localFont(${JSON.stringify(options, null, 2)});\n`,
  };
}

async function main() {
  const beyondLatin = contentGlyphsBeyondLatin();
  const subset = new Set(codePoints(subsetText(beyondLatin)));
  await mkdir(OUT, { recursive: true });

  const definitions = [];
  for (const spec of FACES) {
    const [subsetHalf, restHalf] = await split(spec, subset);
    definitions.push(definition(spec, subsetHalf, false));
    definitions.push(definition(spec, restHalf, true));
  }

  const source = [
    "// Generated by `npm run fonts` (scripts/fonts.ts), which says why each face",
    "// is set as it is. Edit that script, not this file.",
    'import localFont from "next/font/local";',
    "",
    ...definitions.map(({ code }) => code),
    "export const fontVariables = [",
    ...definitions.map(({ name }) => `  ${name},`),
    "]",
    "  .map((font) => font.variable)",
    '  .join(" ");',
  ].join("\n");
  const prettier = await resolveConfig(DEFINITIONS);
  await writeFile(
    DEFINITIONS,
    await format(source, { ...prettier, filepath: DEFINITIONS })
  );
  await writeFile(
    path.join(OUT, "glyphs.json"),
    JSON.stringify({ beyondLatin }, null, 2) + "\n"
  );
  console.log(`Glyphs beyond latin: ${beyondLatin || "none"}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
