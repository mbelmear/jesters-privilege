// What the link-preview cards are drawn from (site-card.tsx and
// episode-card.tsx): the brand faces, the palette, and pictures from public/,
// read at build time. Next's ImageResponse can't read CSS variables or WOFF2,
// so colors come from the design tokens as literals and the faces as TrueType
// (scripts/fonts.ts writes them to src/fonts/cards/).
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { FocalPoint, ImageFile } from "@/lib/content";
import { cropAround } from "@/lib/images";
import { palette } from "@/lib/palette";

const fromRoot = (...parts: string[]) => join(process.cwd(), ...parts);

const DISPLAY = "Gloock";
const UI = "Barlow Semi Condensed";

// The faces cards set text in, as styles to spread: the brand's display face
// and its UI face's heavier weight, the ones the design tokens name. A card
// can't read the tokens' CSS variables, so this is the one place that names
// the families.
export const cardFaces = {
  // eslint-disable-next-line no-restricted-syntax -- ImageResponse can't read the font tokens' CSS variables
  display: { fontFamily: DISPLAY, fontWeight: 400 },
  // eslint-disable-next-line no-restricted-syntax -- ImageResponse can't read the font tokens' CSS variables
  ui: { fontFamily: UI, fontWeight: 600 },
} as const;

export async function cardFonts() {
  const [display, ui] = await Promise.all([
    readFile(fromRoot("src/fonts/cards/gloock.ttf")),
    readFile(fromRoot("src/fonts/cards/barlow-semi-condensed-600.ttf")),
  ]);
  return [
    { name: DISPLAY, data: display, weight: 400, style: "normal" },
    { name: UI, data: ui, weight: 600, style: "normal" },
  ] as const;
}

// The card's colors, by palette name (globals.css).
export async function cardColors() {
  const color = palette(
    await readFile(fromRoot("src/app/globals.css"), "utf8")
  );
  return {
    parchment: color("parchment"),
    edge: color("parchment-edge"),
    teal: color("teal"),
    ink: color("ink"),
    inkSoft: color("ink-soft"),
    display: color("orange-deep"),
  };
}

// A picture under public/, scaled to the width it's drawn at, as a data URL.
export async function picture(src: string, width: number): Promise<string> {
  const png = await sharp(fromRoot("public", src))
    .resize({ width })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

// A painting cut to the given size around its focal point, as a data URL.
export async function paintingDetail(
  painting: ImageFile & { focalPoint: FocalPoint },
  size: { width: number; height: number }
): Promise<string> {
  const region = cropAround(painting, painting.focalPoint, size);
  const jpeg = await sharp(fromRoot("public", painting.src))
    .extract(region)
    .resize(size)
    .jpeg({ quality: 85 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}
