import type { Metadata, MetadataRoute } from "next";

type OpenGraph = NonNullable<Metadata["openGraph"]>;
import { episodeAddress, episodePath, findEpisode, type Episode } from "./feed";
import { publishDateAttribute } from "./format-episode";

// What search engines and link previews read about the site and its pages.
// Addresses are paths on the site; the root layout's metadataBase makes them
// absolute.

export type SiteIdentity = {
  readonly name: string;
  readonly tagline: string;
  readonly url: string;
};

// A link-preview card: its address and what it shows, for those who can't
// see it.
export type CardImage = { path: string; alt: string };

export type PageSeo = {
  // The page's address: "/" or "/about", never "/about/" or "/about.html".
  path: string;
  // Absent on the home page, which goes by the show's name alone.
  title?: string;
  description: string;
  // Absent on pages that share the site-wide card.
  card?: CardImage;
};

// Every card is drawn at the size link previews show uncropped.
export const CARD_SIZE = { width: 1200, height: 630 };

// A page's title, description, canonical address, and link preview. A page's
// openGraph replaces the layout's whole, so the site name and card ride along
// on every page.
export function pageMetadata(site: SiteIdentity, page: PageSeo): Metadata {
  const { path, title, description } = page;
  assertCleanPath(path);
  return {
    title: title ?? { absolute: site.name },
    description,
    alternates: { canonical: path },
    openGraph: {
      ...siteOpenGraph(site, page.card),
      title: title ?? site.name,
      description,
      url: path,
    },
  };
}

// The link preview every page shares unless it sets its own: the site's name
// and card. The root layout gives it to pages, such as the 404 page, that
// have no address of their own.
export function siteOpenGraph(site: SiteIdentity, card?: CardImage): OpenGraph {
  const { path, alt } = card ?? {
    path: SITE_CARD_PATH,
    alt: `${site.name}: ${site.tagline}`,
  };
  return {
    type: "website",
    siteName: site.name,
    images: [{ url: path, ...CARD_SIZE, alt }],
  };
}

// The sitemap: each page, then each Episode dated by when it was published.
// Its addresses are absolute, as the sitemap protocol asks.
export function sitemapEntries(
  site: SiteIdentity,
  paths: readonly string[],
  episodes: readonly Episode[]
): MetadataRoute.Sitemap {
  return [
    ...paths.map((path) => {
      assertCleanPath(path);
      return { url: absoluteUrl(site, path) };
    }),
    ...episodes.map((episode) => ({
      url: absoluteUrl(site, episodePath(episode)),
      lastModified: episode.publishedAt,
    })),
  ];
}

// Link-preview cards are PNGs the build draws (src/app/cards/), one for the
// site and one per Episode, each at an address of its own under /cards.
export const CARDS_ROOT = "/cards";
const SITE_CARD = "site.png";

export type Card = { kind: "site" } | { kind: "episode"; episode: Episode };

export const SITE_CARD_PATH = `${CARDS_ROOT}/${SITE_CARD}`;

export function episodeCardPath(episode: Episode): string {
  return [CARDS_ROOT, ...episodeCardAddress(episode)].join("/");
}

// Every card's address under /cards, for the build to draw.
export function cardPaths(episodes: readonly Episode[]): string[][] {
  return [[SITE_CARD], ...episodes.map(episodeCardAddress)];
}

// The card at an address under /cards.
export function cardAt(
  address: readonly string[],
  episodes: readonly Episode[]
): Card {
  if (address.length === 1 && address[0] === SITE_CARD) return { kind: "site" };
  const [section, ...rest] = address;
  const last = rest.at(-1);
  if (section === "episodes" && last?.endsWith(".png")) {
    const sequence = findEpisode(episodes, [
      ...rest.slice(0, -1),
      last.slice(0, -".png".length),
    ]);
    if (sequence) return { kind: "episode", episode: sequence.episode };
  }
  throw new Error(`Cards: no card at "${[CARDS_ROOT, ...address].join("/")}"`);
}

function episodeCardAddress(episode: Episode): string[] {
  const address = episodeAddress(episode);
  return ["episodes", ...address.slice(0, -1), `${address.at(-1)}.png`];
}

// The show, for structured data: who it is, where its feed lives, and its
// picture.
export type Series = {
  site: SiteIdentity;
  description: string;
  feedUrl: string;
  imagePath: string;
};

type JsonLd = { readonly [key: string]: unknown };

// The show as schema.org's PodcastSeries, for the home page.
export function seriesJsonLd(series: Series): JsonLd {
  const { site, description, feedUrl, imagePath } = series;
  return {
    "@context": "https://schema.org",
    "@type": "PodcastSeries",
    name: site.name,
    description,
    url: absoluteUrl(site, "/"),
    webFeed: feedUrl,
    image: absoluteUrl(site, imagePath),
  };
}

// An Episode as schema.org's PodcastEpisode, for its page. The audio address
// is the feed's own, so Podtrac still counts the download.
export function episodeJsonLd(series: Series, episode: Episode): JsonLd {
  const { site } = series;
  return {
    "@context": "https://schema.org",
    "@type": "PodcastEpisode",
    name: episode.title,
    ...(episode.type === "full" && { episodeNumber: episode.number }),
    url: absoluteUrl(site, episodePath(episode)),
    datePublished: publishDateAttribute(episode.publishedAt),
    description: episode.excerpt,
    timeRequired: isoDuration(episode.durationSeconds),
    associatedMedia: { "@type": "MediaObject", contentUrl: episode.audioUrl },
    partOfSeries: {
      "@type": "PodcastSeries",
      name: site.name,
      url: absoluteUrl(site, "/"),
    },
  };
}

// The text for a <script type="application/ld+json">. "<" is escaped, so a
// title from the feed can't end the script element early.
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

// 2592 seconds as "PT43M12S".
function isoDuration(totalSeconds: number): string {
  const seconds = Math.round(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `PT${hours > 0 ? `${hours}H` : ""}${minutes}M${seconds % 60}S`;
}

function absoluteUrl(site: SiteIdentity, path: string): string {
  return new URL(path, site.url).href;
}

function assertCleanPath(path: string): void {
  if (path !== "/" && !/^(\/[a-z0-9-]+)+$/.test(path)) {
    throw new Error(
      `SEO: "${path}" isn't a page address; use a path like "/about", with no trailing slash, extension, or #fragment`
    );
  }
}
