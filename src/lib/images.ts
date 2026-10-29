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

export function imageUrl({ src, width, format, crop }: ImageRequest): string {
  const name = crop ? `${crop}-${width}` : `${width}`;
  return `${IMAGE_ROOT}${src.replace(/\.[^./]+$/, "")}/${name}.${format}`;
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
