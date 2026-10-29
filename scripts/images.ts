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
import { IMAGE_ROOT, planImage, type Variant } from "@/lib/images";

const PUBLIC = "public";
const OUT = path.join(PUBLIC, IMAGE_ROOT);

// Tuned so a phone's painting stays near 150 KB (docs/testing.md).
const ENCODING = {
  avif: { quality: 45, effort: 6 },
  webp: { quality: 72, effort: 4 },
} as const;

async function main() {
  const images = findImages(content);
  const folders = new Set<string>();
  let made = 0;
  for (const image of images) {
    const folder = path.join(OUT, image.src.replace(/\.[^./]+$/, ""));
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
      `Image ${image.src} (content ${image.path}) isn't in ${PUBLIC}/`
    );
  });
  const { width, height } = await sharp(source).metadata();
  if (width !== image.width || height !== image.height) {
    throw new Error(
      `Image ${image.src} is ${width}×${height}, but content ${image.path} gives ${image.width}×${image.height}`
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
  await Promise.all(variants.map((variant) => encode(source, variant)));
  await writeFile(stampFile, stamp);
  return true;
}

async function encode(source: Buffer, variant: Variant): Promise<void> {
  const image = sharp(source);
  if (variant.crop) image.extract(variant.crop);
  image.resize({ width: variant.width });
  const encoded =
    variant.format === "avif"
      ? image.avif(ENCODING.avif)
      : image.webp(ENCODING.webp);
  await encoded.toFile(path.join(PUBLIC, variant.url));
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
