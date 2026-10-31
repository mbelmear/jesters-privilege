import { IMAGE_SIZES, type Variant } from "./images";

// The build's budget for what a phone downloads of a painting, and the
// encoding that decides it. Build-only: scripts/images.ts enforces it, and
// add-painting estimates a new painting against it. Kept apart from
// src/lib/images.ts, which the image loader ships to the browser.

// How the build encodes every generated file.
export const ENCODING = {
  avif: { quality: 45, effort: 6 },
  webp: { quality: 72, effort: 4 },
} as const;

// What a phone downloads of a painting must stay near 150 KB (#13,
// docs/testing.md), or the build fails; the limit leaves headroom for a busy
// canvas. "Phone" means one held upright, up to 430 CSS px at 3×: there a band
// spans the screen with its portrait crop, and a framed painting shows whole
// at no more than 90vw (the sizes in painting-band.tsx and
// framed-painting.tsx). Each takes the first srcset width that covers it.
// A phone turned sideways, at 48rem or wider, gets the desktop layout and its
// larger files, which this doesn't check.
export const PHONE_BYTES = 180_000;
const PHONE_PIXELS = 430 * 3;
const phoneWidth = (fraction: number) =>
  IMAGE_SIZES.deviceSizes.find((width) => width >= PHONE_PIXELS * fraction) ??
  failNoPhoneWidth(fraction);
function failNoPhoneWidth(fraction: number): never {
  throw new Error(
    `No deviceSizes width in src/lib/images.ts covers a ${PHONE_PIXELS}px phone at ${fraction * 100}vw; add one`
  );
}
export const PHONE_WIDTHS = { crop: phoneWidth(1), whole: phoneWidth(0.9) };

export type MadeVariant = { readonly variant: Variant; readonly bytes: number };

// The heaviest AVIF a phone would download of a painting past PHONE_BYTES, if
// any.
export function heaviestOverPhoneBudget(
  made: readonly MadeVariant[]
): MadeVariant | undefined {
  return made
    .filter(
      ({ variant, bytes }) =>
        variant.format === "avif" &&
        variant.width <=
          (variant.crop ? PHONE_WIDTHS.crop : PHONE_WIDTHS.whole) &&
        bytes > PHONE_BYTES
    )
    .reduce<MadeVariant | undefined>(
      (heaviest, item) =>
        heaviest && heaviest.bytes >= item.bytes ? heaviest : item,
      undefined
    );
}
