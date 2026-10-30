import { isTag, isText, type ChildNode } from "domhandler";
import { parseDocument } from "htmlparser2";

// A painting's file on Wikimedia Commons, read from the API's image info
// (action=query, prop=imageinfo, iiprop=url|size|extmetadata, formatversion=2)
// for scripts/add-painting.ts. Metadata a file page doesn't give is absent.
export type CommonsFile = {
  readonly title: string;
  readonly fileUrl: string;
  readonly pageUrl: string;
  readonly width: number;
  readonly height: number;
  readonly license: string;
  readonly name?: string;
  readonly artist?: string;
  readonly date?: string;
};

// A file's title from what a person pastes: the title itself, or the file
// page's address.
export function commonsTitle(input: string): string {
  if (input.startsWith("File:")) return input;
  const page = URL.parse(input);
  if (
    page?.hostname === "commons.wikimedia.org" &&
    page.pathname.startsWith("/wiki/File:")
  ) {
    return decodeURIComponent(page.pathname.slice("/wiki/".length));
  }
  throw new Error(
    `Expected a Commons file title ("File:…") or file page address, not "${input}"`
  );
}

// The API's answer enters as unknown and leaves as a CommonsFile, or throws.
export function parseCommonsFile(response: unknown): CommonsFile {
  const page = first(field(field(response, "query"), "pages"));
  const title = field(page, "title");
  if (typeof title === "string" && field(page, "missing") === true) {
    throw new Error(`Commons has no file ${title}`);
  }
  const info = first(field(page, "imageinfo"));
  const fileUrl = field(info, "url");
  const pageUrl = field(info, "descriptionurl");
  const width = field(info, "width");
  const height = field(info, "height");
  const metadata = field(info, "extmetadata");
  const license = metadataText(metadata, "LicenseShortName");
  if (
    typeof title !== "string" ||
    typeof fileUrl !== "string" ||
    typeof pageUrl !== "string" ||
    typeof width !== "number" ||
    typeof height !== "number" ||
    license === undefined
  ) {
    throw new Error("Commons answered without image info for one file");
  }
  const name = metadataText(metadata, "ObjectName");
  const artist = metadataText(metadata, "Artist");
  const date = metadataText(metadata, "DateTimeOriginal");
  return {
    title,
    fileUrl,
    pageUrl,
    width,
    height,
    license,
    ...(name && { name }),
    ...(artist && { artist }),
    ...(date && { date }),
  };
}

// The site shows only public-domain paintings (docs/spec.md, Paintings).
export function assertPublicDomain(file: CommonsFile): void {
  if (!/^public domain$/i.test(file.license)) {
    throw new Error(
      `${file.title} is licensed "${file.license}", not public domain`
    );
  }
}

/**
 * A src/content/paintings.ts entry for the file, saved at `size`. What a
 * person must supply (alt text, medium, collection, and the focal point) is
 * left empty or centred: content validation refuses an empty string, so the
 * build fails until each is written.
 */
export function paintingEntry(
  slug: string,
  file: CommonsFile,
  size: { width: number; height: number }
): string {
  const key = /^[A-Za-z_$][\w$]*$/.test(slug) ? slug : JSON.stringify(slug);
  const text = (value?: string) => JSON.stringify(value ?? "");
  return [
    `  ${key}: {`,
    `    src: ${text(`/paintings/${slug}.jpg`)},`,
    `    width: ${size.width},`,
    `    height: ${size.height},`,
    `    source:`,
    `      ${text(file.pageUrl)},`,
    `    alt: "",`,
    `    focalPoint: { x: 0.5, y: 0.5 },`,
    `    placard: {`,
    `      artist: ${text(file.artist)},`,
    `      title: ${text(file.name)},`,
    `      year: ${text(file.date)},`,
    `      medium: "",`,
    `      collection: "",`,
    `    },`,
    `  },`,
  ].join("\n");
}

function field(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null && key in value
    ? Object.entries(value).find(([name]) => name === key)?.[1]
    : undefined;
}

function first(value: unknown): unknown {
  return Array.isArray(value) ? value.at(0) : undefined;
}

// A metadata field's HTML as the text a reader of the file page sees:
// hidden Wikidata labels and edit icons are left out.
function metadataText(metadata: unknown, key: string): string | undefined {
  const html = field(field(metadata, key), "value");
  if (typeof html !== "string") return undefined;
  const text = visibleText(parseDocument(html).children)
    .replace(/\s+/g, " ")
    .trim();
  return text === "" ? undefined : text;
}

function visibleText(nodes: ChildNode[]): string {
  return nodes
    .map((node) => {
      if (isText(node)) return node.data;
      if (!isTag(node) || /display:\s*none/.test(node.attribs.style ?? "")) {
        return "";
      }
      return visibleText(node.children);
    })
    .join("");
}
