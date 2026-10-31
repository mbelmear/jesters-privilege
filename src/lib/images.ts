import type { FocalPoint } from "./content";

// The image pipeline: which files the build makes from each image the site
// shows, and the URL a page uses for each. scripts/images.ts makes the files;
// components ask for them through next/image loaders built on imageUrl.

export const IMAGE_FORMATS = ["avif", "webp"] as const;
export type ImageFormat = (typeof IMAGE_FORMATS)[number];

// Generated files live under public/images/, one folder per source image.
export const IMAGE_ROOT = "/images";

// The widths next/image may put in a srcset (next.config.ts hands it both
// lists), so the build makes a file at each: deviceSizes for images that span
// the screen, imageSizes for small ones such as the logo.
export const IMAGE_SIZES = {
  deviceSizes: [640, 828, 1200, 1600, 2048],
  imageSizes: [128, 256, 384],
} as const;
export const IMAGE_WIDTHS = [
  ...IMAGE_SIZES.imageSizes,
  ...IMAGE_SIZES.deviceSizes,
] as const;

type Size = { readonly width: number; readonly height: number };

// Crops the build cuts around an image's focal point. Painting bands show the
// portrait one on phones.
export const CROP_NAMES = ["portrait"] as const;
export type CropName = (typeof CROP_NAMES)[number];

// Each crop's shape, as width:height.
export const CROP_SHAPES: Record<CropName, Size> = {
  portrait: { width: 4, height: 5 },
};
export type Rect = Size & { readonly left: number; readonly top: number };

/**
 * The largest region of an image with the crop's shape, centred on the focal
 * point (fractions of the width and height) as nearly as the edges allow, so
 * the subject stays in view.
 */
export function cropAround(
  image: Size,
  focalPoint: FocalPoint,
  crop: CropName
): Rect {
  const shape = CROP_SHAPES[crop].width / CROP_SHAPES[crop].height;
  const width = Math.min(image.width, Math.round(image.height * shape));
  const height = Math.min(image.height, Math.round(image.width / shape));
  const offset = (length: number, cut: number, fraction: number) =>
    Math.min(
      length - cut,
      Math.max(0, Math.round(length * fraction - cut / 2))
    );
  return {
    left: offset(image.width, width, focalPoint.x),
    top: offset(image.height, height, focalPoint.y),
    width,
    height,
  };
}

type ImageRequest = {
  // The source's path under public/, such as "/paintings/stanczyk.jpg".
  readonly src: string;
  readonly width: number;
  readonly format: ImageFormat;
  readonly crop?: CropName;
};

// The folder holding an image's generated files, named for its source.
export function imageFolder(src: string): string {
  return `${IMAGE_ROOT}${src.replace(/\.[^./]+$/, "")}`;
}

export function imageUrl({ src, width, format, crop }: ImageRequest): string {
  const name = crop ? `${crop}-${width}` : `${width}`;
  return `${imageFolder(src)}/${name}.${format}`;
}

// An image the site shows: a file under public/ and its size in pixels. One
// with a focal point also gets crops cut around it.
export type SourceImage = Size & {
  readonly src: string;
  readonly focalPoint?: FocalPoint;
};

// One file for the build to make: the URL pages use for it, and the width it
// is actually made at, which is never wider than its source.
export type Variant = {
  readonly url: string;
  readonly format: ImageFormat;
  readonly width: number;
  readonly crop?: Rect;
};

export function planImage(image: SourceImage): Variant[] {
  const { src, focalPoint } = image;
  const each = (region: Size, crop?: CropName): Variant[] =>
    IMAGE_WIDTHS.flatMap((width) =>
      IMAGE_FORMATS.map((format) => ({
        url: imageUrl({ src, width, format, crop }),
        format,
        width: Math.min(width, region.width),
      }))
    );
  const whole = each(image);
  if (!focalPoint) return whole;
  const crops = CROP_NAMES.flatMap((crop) => {
    const rect = cropAround(image, focalPoint, crop);
    return each(rect, crop).map((variant) => ({ ...variant, crop: rect }));
  });
  return [...whole, ...crops];
}

// How the build encodes every generated file. scripts/images.ts makes them,
// and add-painting estimates a new painting's phone files with the same
// settings.
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
