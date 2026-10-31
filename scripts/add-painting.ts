// Adds a public-domain painting from Wikimedia Commons: saves it to
// public/paintings/<slug>.jpg at most 2400px on its long side, and prints the
// entry for src/content/paintings.ts with its size, source, and the placard
// text Commons gives. Refuses a file that isn't public domain.
//
// It also writes a copy ruled in tenths, to read the focal point off, and
// estimates what a phone would download, so a painting too busy for the image
// budget shows before the build. --detail keeps only a region of the file
// (left,top,width,height as fractions), such as one drawing on a sheet.
// Usage: npm run add-painting -- "<File:… or its Commons page address>" <slug> [--detail l,t,w,h]
import { access, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp, { type Sharp } from "sharp";
import {
  assertPublicDomain,
  assertSlug,
  commonsTitle,
  detailRect,
  paintingEntry,
  parseCommonsFile,
  parseDetail,
} from "@/lib/commons";
import { cropAround, type Size } from "@/lib/images";
import { ENCODING, PHONE_BYTES, PHONE_WIDTHS } from "@/lib/phone-budget";

const API = "https://commons.wikimedia.org/w/api.php";
// Wikimedia asks every client to name itself and give a contact.
const USER_AGENT =
  "JestersPrivilegeSite/1.0 (hello@jestersprivilegepodcast.com)";
const LONG_SIDE = 2400;
// sharp opens up to 268 million pixels; a detail's download stays well inside.
const MAX_DOWNLOAD_SIDE = 8000;
const GRID_SIDE = 800;

async function main() {
  const [input, slug, flag, detailArg] = process.argv.slice(2);
  if (
    !input ||
    slug === undefined ||
    (flag !== undefined && (flag !== "--detail" || detailArg === undefined))
  ) {
    throw new Error(
      'Usage: npm run add-painting -- "<File:… or its Commons page address>" <slug> [--detail l,t,w,h]'
    );
  }
  assertSlug(slug);
  const detail = detailArg === undefined ? undefined : parseDetail(detailArg);
  const out = `public/paintings/${slug}.jpg`;
  if (
    await access(out).then(
      () => true,
      () => false
    )
  ) {
    throw new Error(`${out} already exists; pick another slug or delete it`);
  }

  const downloadSide = detail
    ? Math.min(
        MAX_DOWNLOAD_SIDE,
        Math.ceil(LONG_SIDE / Math.min(detail.width, detail.height))
      )
    : LONG_SIDE;
  const query = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    titles: commonsTitle(input),
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    // Commons' originals run to 30,000px, past what sharp will open. A detail
    // asks for a larger copy, so the region it keeps still nears LONG_SIDE.
    iiurlwidth: String(downloadSide),
    iiurlheight: String(downloadSide),
    iiextmetadatafilter: "LicenseShortName|Artist|DateTimeOriginal|ObjectName",
  });
  const file = parseCommonsFile(await fetchJson(`${API}?${query}`));
  assertPublicDomain(file);

  const download = await sharp(await fetchBytes(file.downloadUrl))
    .rotate()
    .toBuffer({ resolveWithObject: true });
  const region = detail ? detailRect(download.info, detail) : undefined;
  const { data, info } = await sharp(download.data)
    .extract(
      region ?? {
        left: 0,
        top: 0,
        width: download.info.width,
        height: download.info.height,
      }
    )
    .resize(LONG_SIDE, LONG_SIDE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  await writeFile(out, data);
  const grid = await writeGrid(slug, data);
  const phone = await phoneEstimates(data, info);

  console.log(
    [
      `Saved ${out} (${info.width}×${info.height}, ${Math.round(info.size / 1000)} KB) from ${file.pageUrl}`,
      "",
      "Add this to `paintings` in src/content/paintings.ts:",
      "",
      paintingEntry(slug, file, info, detailArg),
      "",
      "Then, before the build passes:",
      "  - alt: who is shown, and what they're doing",
      `  - focalPoint: open ${grid}, ruled in tenths, set the subject's centre as fractions of width and height, and uncomment it`,
      "  - placard: check the artist, title, and year Commons gave; add the medium and collection",
      "  - npm run images",
      "",
      ...phone,
    ].join("\n")
  );
}

// A copy of the painting ruled in tenths, each line labelled, to read a focal
// point off. Returns where it was written.
async function writeGrid(slug: string, data: Buffer): Promise<string> {
  const preview = await sharp(data)
    .resize(GRID_SIDE, GRID_SIDE, { fit: "inside" })
    .toBuffer({ resolveWithObject: true });
  const { width, height } = preview.info;
  const lines = Array.from({ length: 9 }, (_, index) => {
    const tenth = index + 1;
    const x = (width * tenth) / 10;
    const y = (height * tenth) / 10;
    const label = `fill="yellow" stroke="black" stroke-width="0.5" font-size="14" font-family="sans-serif"`;
    return [
      `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="red"/>`,
      `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="red"/>`,
      `<text x="${x + 2}" y="14" ${label}>.${tenth}</text>`,
      `<text x="2" y="${y - 3}" ${label}>.${tenth}</text>`,
    ].join("");
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${lines}</svg>`;
  const folder = path.join(tmpdir(), "add-painting");
  await mkdir(folder, { recursive: true });
  const file = path.join(folder, `${slug}-grid.jpg`);
  await sharp(preview.data)
    .composite([{ input: Buffer.from(svg) }])
    .jpeg()
    .toFile(file);
  return file;
}

// What a phone would download of the painting, whole and as a band's portrait
// crop around its centre, against the budget `npm run images` enforces.
async function phoneEstimates(data: Buffer, size: Size): Promise<string[]> {
  const avif = async (image: Sharp, width: number) =>
    (await image.resize({ width }).avif(ENCODING.avif).toBuffer()).length;
  const whole = await avif(
    sharp(data),
    Math.min(PHONE_WIDTHS.whole, size.width)
  );
  const rect = cropAround(size, { x: 0.5, y: 0.5 }, "portrait");
  const crop = await avif(
    sharp(data).extract(rect),
    Math.min(PHONE_WIDTHS.crop, rect.width)
  );
  const line = (name: string, bytes: number) =>
    `  - ${name}: ${Math.round(bytes / 1000)} KB${bytes > PHONE_BYTES ? ` (over ${PHONE_BYTES / 1000} KB)` : ""}`;
  return [
    "A phone would download about:",
    line("framed, whole", whole),
    line("as a band, portrait crop around the centre", crop),
    ...(Math.max(whole, crop) > PHONE_BYTES
      ? [
          "Over budget: choose a calmer painting or scan, or cut a detail with --detail.",
        ]
      : []),
  ];
}

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`Commons answered ${response.status} for ${url}`);
  }
  return response;
}

async function fetchJson(url: string): Promise<unknown> {
  const body: unknown = await (await fetchOk(url)).json();
  return body;
}

async function fetchBytes(url: string): Promise<Buffer> {
  return Buffer.from(await (await fetchOk(url)).arrayBuffer());
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
