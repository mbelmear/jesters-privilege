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
  ENCODING,
  IMAGE_ROOT,
  PHONE_BYTES,
  heaviestOverPhoneBudget,
  imageFolder,
  planImage,
  type Variant,
} from "@/lib/images";

const PUBLIC = "public";
const OUT = path.join(PUBLIC, IMAGE_ROOT);

async function main() {
  const images = findImages(content);
  const folders = new Set<string>();
  let made = 0;
  const overBudget: string[] = [];
  for (const image of images) {
    const folder = path.join(PUBLIC, imageFolder(image.src));
    folders.add(folder);
    const result = await makeSet(image, folder);
    if (result !== "unchanged") made += 1;
    if (typeof result === "object") overBudget.push(result.overBudget);
  }
  // Every painting over budget at once, so one run shows all there is to fix.
  if (overBudget.length > 0) {
    throw new Error(
      [
        `A phone should download at most ${PHONE_BYTES / 1000} KB of one painting. Fine detail costs bytes: choose a calmer painting or scan, cut a detail (npm run add-painting -- … --detail), or move a band's focalPoint so its phone crop takes in a calmer part. Lowering ENCODING.avif.quality in src/lib/images.ts would re-encode every painting at the lower quality.`,
        ...overBudget,
      ].join("\n  ")
    );
  }
  const removed = await removeStale(OUT, folders);
  console.log(
    `Images: ${images.length} in content, ${made} made, ${images.length - made} unchanged, ${removed} removed.`
  );
}

// Makes the set unless its stamp shows it unchanged. A painting over the phone
// budget gets no stamp, so the next run checks it again.
async function makeSet(
  image: FoundImage,
  folder: string
): Promise<"unchanged" | "made" | { overBudget: string }> {
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
    return "unchanged";
  }
  await rm(folder, { recursive: true, force: true });
  await mkdir(folder, { recursive: true });
  const made = await Promise.all(
    variants.map(async (variant) => ({
      variant,
      bytes: await encode(source, variant),
    }))
  );
  // Only paintings carry a focal point (the Painting type requires one). A
  // dense painting, such as Bruegel's Netherlandish Proverbs, can pass the
  // budget alone; the fix is usually that painting, not the encoding every
  // painting shares (#24).
  const heaviest = image.focalPoint && heaviestOverPhoneBudget(made);
  if (heaviest) {
    return {
      overBudget: `${heaviest.variant.url}: ${Math.round(heaviest.bytes / 1000)} KB (content ${image.contentPath})`,
    };
  }
  await writeFile(stampFile, stamp);
  return "made";
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
