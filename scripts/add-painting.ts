// Adds a public-domain painting from Wikimedia Commons: saves it to
// public/paintings/<slug>.jpg at most 2400px on its long side, and prints the
// entry for src/content/paintings.ts with its size, source, and the placard
// text Commons gives. Refuses a file that isn't public domain.
// Usage: npm run add-painting -- "<File:… or its Commons page address>" <slug>
import { access, writeFile } from "node:fs/promises";
import sharp from "sharp";
import {
  assertPublicDomain,
  commonsTitle,
  paintingEntry,
  parseCommonsFile,
} from "@/lib/commons";

const API = "https://commons.wikimedia.org/w/api.php";
// Wikimedia asks every client to name itself and give a contact.
const USER_AGENT =
  "JestersPrivilegeSite/1.0 (hello@jestersprivilegepodcast.com)";
const LONG_SIDE = 2400;

async function main() {
  const [input, slug] = process.argv.slice(2);
  if (!input || !slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(
      'Usage: npm run add-painting -- "<File:… or its Commons page address>" <slug>, with a slug such as will-somers'
    );
  }
  const out = `public/paintings/${slug}.jpg`;
  if (
    await access(out).then(
      () => true,
      () => false
    )
  ) {
    throw new Error(`${out} already exists; pick another slug or delete it`);
  }

  const query = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    titles: commonsTitle(input),
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiextmetadatafilter: "LicenseShortName|Artist|DateTimeOriginal|ObjectName",
  });
  const file = parseCommonsFile(await fetchJson(`${API}?${query}`));
  assertPublicDomain(file);

  const original = await fetchBytes(file.fileUrl);
  const { data, info } = await sharp(original)
    .rotate()
    .resize(LONG_SIDE, LONG_SIDE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  await writeFile(out, data);

  console.log(
    [
      `Saved ${out} (${info.width}×${info.height}, ${Math.round(info.size / 1000)} KB) from ${file.pageUrl}`,
      "",
      "Add this to `paintings` in src/content/paintings.ts:",
      "",
      paintingEntry(slug, file, info),
      "",
      "Then, before the build passes:",
      "  - alt: who is shown, and what they're doing",
      "  - focalPoint: open the painting and set the subject's centre, as fractions of width and height",
      "  - placard: check the artist, title, and year Commons gave; add the medium and collection",
      "  - npm run images",
    ].join("\n")
  );
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok)
    throw new Error(`Commons answered ${response.status} for ${url}`);
  const body: unknown = await response.json();
  return body;
}

async function fetchBytes(url: string): Promise<Buffer> {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok)
    throw new Error(`Commons answered ${response.status} for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
