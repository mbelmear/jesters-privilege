import {
  Barlow_Semi_Condensed,
  Gloock,
  Source_Serif_4,
} from "next/font/google";

// The three typefaces, self-hosted by next/font. Each sets a CSS variable that
// the font tokens in globals.css (font-display, font-body, font-ui) read.
// Together they must fit the font budget in lighthouserc.json.

/** Display: headlines, decree-style titles, the drop cap. */
export const gloock = Gloock({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-gloock",
});

/**
 * Body: reading text, preloaded because it's usually the largest paint.
 * Variable weight; the optical-size axis is left out because it more than
 * doubles the file.
 */
export const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
});

/**
 * The body italic, loaded separately and not preloaded, so only pages that
 * use it download it. next/font declares it under the same family name
 * ("Source Serif 4"), so the browser joins it to the upright face and
 * `font-body` covers both.
 */
const sourceSerifItalic = Source_Serif_4({
  subsets: ["latin"],
  style: "italic",
  variable: "--font-source-serif-italic",
  preload: false,
});

/**
 * UI: navigation, buttons, labels, metadata. Not preloaded: it's small text,
 * where swapping in late is harmless, and preloading it delays the first
 * paint of the headline and body.
 */
export const barlowSemiCondensed = Barlow_Semi_Condensed({
  weight: ["500", "600"],
  subsets: ["latin"],
  variable: "--font-barlow-semi-condensed",
  preload: false,
});

export const fontVariables = [
  gloock,
  sourceSerif,
  sourceSerifItalic,
  barlowSemiCondensed,
]
  .map((font) => font.variable)
  .join(" ");
