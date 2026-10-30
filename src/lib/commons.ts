import { isTag, isText, type ChildNode } from "domhandler";
import { parseDocument } from "htmlparser2";

// A painting's file on Wikimedia Commons, read from the API's image info
// (action=query, prop=imageinfo, iiprop=url|size|extmetadata, formatversion=2,
// iiurlwidth and iiurlheight) for scripts/add-painting.ts. Metadata a file
// page doesn't give is absent.
export type CommonsFile = {
  // The Commons title, "File:…".
  readonly fileTitle: string;
  // A copy Commons resizes to fit the iiurlwidth × iiurlheight box (the
  // original when that's smaller), so no scan is too large to open.
  readonly downloadUrl: string;
  readonly pageUrl: string;
  readonly width: number;
  readonly height: number;
  readonly license: string;
  // The painting's own title, for its placard.
  readonly paintingTitle?: string;
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

// The API's answer enters as unknown and leaves as a CommonsFile, or throws
// naming the field it couldn't read.
export function parseCommonsFile(response: unknown): CommonsFile {
  const page = first(field(field(response, "query"), "pages"));
  const fileTitle = field(page, "title");
  if (typeof fileTitle !== "string") {
    throw new Error("Commons answered without a file page");
  }
  if (field(page, "missing") === true) {
    throw new Error(`Commons has no file ${fileTitle}`);
  }
  const info = first(field(page, "imageinfo"));
  const missing = (name: string) =>
    new Error(`Commons gave no ${name} for ${fileTitle}`);
  const text = (key: string, name: string) => {
    const value = field(info, key);
    if (typeof value !== "string") throw missing(name);
    return value;
  };
  const count = (key: string) => {
    const value = field(info, key);
    if (typeof value !== "number") throw missing(key);
    return value;
  };
  const metadata = field(info, "extmetadata");
  const license = metadataText(metadata, "LicenseShortName");
  if (license === undefined) throw missing("license");
  const paintingTitle = metadataText(metadata, "ObjectName");
  const artist = metadataText(metadata, "Artist");
  const date = metadataText(metadata, "DateTimeOriginal");
  return {
    fileTitle,
    downloadUrl: text("thumburl", "resized file address"),
    pageUrl: text("descriptionurl", "file page address"),
    width: count("width"),
    height: count("height"),
    license,
    ...(paintingTitle && { paintingTitle }),
    ...(artist && { artist }),
    ...(date && { date }),
  };
}

// A painting's slug names its file and its catalogue entry.
export function assertSlug(slug: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(
      `A painting's slug is lowercase words joined by hyphens, such as will-somers, not "${slug}"`
    );
  }
}

// The site shows only public-domain paintings (docs/spec.md, Paintings).
export function assertPublicDomain(file: CommonsFile): void {
  if (!/^public domain$/i.test(file.license)) {
    throw new Error(
      `${file.fileTitle} is licensed "${file.license}", not public domain`
    );
  }
}

/**
 * A src/content/paintings.ts entry for the file, saved at `size`. What a
 * person must supply fails the build until it's written: alt text, medium,
 * and collection are empty, which content validation refuses, and the focal
 * point is left commented out, which the type check refuses.
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
    `    // focalPoint: { x: , y: },`,
    `    placard: {`,
    `      artist: ${text(file.artist)},`,
    `      title: ${text(file.paintingTitle)},`,
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
