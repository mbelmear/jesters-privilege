// Makes the responsive set of every image the content shows: each width
// next/image may ask for, in AVIF and WebP, plus crops around a painting's
// focal point (src/lib/images.ts plans them). Runs before `next build` and
// `next dev`. Usage: npm run images
//
// Files land in public/images/, one folder per source image with a stamp of
// what made it, so an unchanged image is skipped and a removed one deleted.
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { content } from "@/content";
import { findImages, type FoundImage } from "@/lib/content";
import {
  IMAGE_ROOT,
  IMAGE_SIZES,
  imageFolder,
  planImage,
  type Variant,
} from "@/lib/images";

const PUBLIC = "public";
const OUT = path.join(PUBLIC, IMAGE_ROOT);

// What a phone downloads of a painting must stay near 150 KB (#13,
// docs/testing.md), or the build fails; the limit leaves headroom for a busy
// canvas. "Phone" means one held upright, up to 430 CSS px at 3×: there a band
// spans the screen with its portrait crop, and a framed painting shows whole
// at no more than 90vw (the sizes in painting-band.tsx and
// framed-painting.tsx). Each takes the first srcset width that covers it.
// A phone turned sideways, at 48rem or wider, gets the desktop layout and its
// larger files, which this doesn't check.
const PHONE_BYTES = 180_000;
const PHONE_PIXELS = 430 * 3;
const phoneWidth = (fraction: number) =>
  IMAGE_SIZES.deviceSizes.find((width) => width >= PHONE_PIXELS * fraction) ??
  failNoPhoneWidth(fraction);
function failNoPhoneWidth(fraction: number): never {
  throw new Error(
    `No deviceSizes width in src/lib/images.ts covers a ${PHONE_PIXELS}px phone at ${fraction * 100}vw; add one`
  );
}
const PHONE_WIDTHS = { crop: phoneWidth(1), whole: phoneWidth(0.9) };

const ENCODING = {
  avif: { quality: 45, effort: 6 },
  webp: { quality: 72, effort: 4 },
} as const;

async function main() {
  const images = findImages(content);
  const folders = new Set<string>();
  let made = 0;
  for (const image of images) {
    const folder = path.join(PUBLIC, imageFolder(image.src));
    folders.add(folder);
    if (await makeSet(image, folder)) made += 1;
  }
  const removed = await removeStale(OUT, folders);
  console.log(
    `Images: ${images.length} in content, ${made} made, ${images.length - made} unchanged, ${removed} removed.`
  );
}

// Returns whether the set had to be made.
async function makeSet(image: FoundImage, folder: string): Promise<boolean> {
  const file = path.join(PUBLIC, image.src);
  const source = await readFile(file).catch(() => {
    throw new Error(
      `Image ${image.src} (content ${image.contentPath}) isn't in ${PUBLIC}/`
    );
  });
  const { width, height } = await sharp(source).metadata();
  if (width !== image.width || height !== image.height) {
    throw new Error(
      `Image ${image.src} is ${width}×${height}, but content ${image.contentPath} gives ${image.width}×${image.height}`
    );
  }
  const variants = planImage(image);
  const stamp = createHash("sha256")
    .update(source)
    .update(JSON.stringify({ variants, ENCODING }))
    .digest("hex");
  const stampFile = path.join(folder, "stamp");
  if ((await readFile(stampFile, "utf8").catch(() => "")) === stamp) {
    return false;
  }
  await rm(folder, { recursive: true, force: true });
  await mkdir(folder, { recursive: true });
  const made = await Promise.all(
    variants.map(async (variant) => ({
      variant,
      bytes: await encode(source, variant),
    }))
  );
  // Only paintings carry a focal point (the Painting type requires one).
  if (image.focalPoint) assertPhoneSizes(image, made);
  await writeFile(stampFile, stamp);
  return true;
}

// Fails when a file a phone would download of this painting is too heavy.
function assertPhoneSizes(
  image: FoundImage,
  made: { variant: Variant; bytes: number }[]
): void {
  for (const { variant, bytes } of made) {
    const widest = variant.crop ? PHONE_WIDTHS.crop : PHONE_WIDTHS.whole;
    if (
      variant.format === "avif" &&
      variant.width <= widest &&
      bytes > PHONE_BYTES
    ) {
      // A dense painting, such as Bruegel's Netherlandish Proverbs, can pass
      // the budget alone; the fix is usually that painting, not the encoding
      // every painting shares (#24).
      const crop = variant.crop
        ? ", or move its focalPoint so the phone crop takes in a calmer part"
        : "";
      throw new Error(
        `Image ${variant.url} is ${Math.round(bytes / 1000)} KB, over the ${PHONE_BYTES / 1000} KB a phone should download for one painting (content ${image.contentPath}). Fine detail costs bytes: choose a calmer painting or scan${crop}. Lowering ENCODING.avif.quality in scripts/images.ts would re-encode every painting at the lower quality.`
      );
    }
  }
}

// Returns the file's size in bytes.
async function encode(source: Buffer, variant: Variant): Promise<number> {
  const image = sharp(source);
  if (variant.crop) image.extract(variant.crop);
  image.resize({ width: variant.width });
  const encoded =
    variant.format === "avif"
      ? image.avif(ENCODING.avif)
      : image.webp(ENCODING.webp);
  const { size } = await encoded.toFile(path.join(PUBLIC, variant.url));
  return size;
}

// Deletes each stamped folder under `root` that no image in content made.
async function removeStale(root: string, keep: Set<string>): Promise<number> {
  const entries = await readdir(root, {
    recursive: true,
    withFileTypes: true,
  }).catch(() => []);
  const stale = entries
    .filter((entry) => entry.isFile() && entry.name === "stamp")
    .map((entry) => entry.parentPath)
    .filter((folder) => !keep.has(folder));
  await Promise.all(
    stale.map((folder) => rm(folder, { recursive: true, force: true }))
  );
  return stale.length;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
