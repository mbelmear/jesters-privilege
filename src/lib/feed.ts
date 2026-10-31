import { getAttributeValue, getElementsByTagName, textContent } from "domutils";
import { parseDocument } from "htmlparser2";
import type { Element } from "domhandler";
import sanitizeHtml from "sanitize-html";

// The values of itunes:episodeType. Only full Episodes are numbered; the others
// live at /episodes/bonus/<slug> (ADR 0002).
export const EPISODE_TYPES = ["full", "bonus", "trailer"] as const;
export type EpisodeType = (typeof EPISODE_TYPES)[number];

export type Episode = EpisodeDetails &
  (
    | { type: "full"; number: number }
    | { type: Exclude<EpisodeType, "full">; slug: string }
  );

type EpisodeDetails = {
  guid: string;
  title: string;
  publishedAt: Date;
  durationSeconds: number;
  audioUrl: string;
  showNotesHtml: string;
  excerpt: string;
  artworkUrl: string;
  transcriptUrl: string | null;
};

export function parseFeed(text: string): Episode[] {
  const document = parseDocument(text, { xmlMode: true });
  const [channel] = getElementsByTagName("channel", document);
  if (!channel) throw new Error("Feed has no <channel>; is this an RSS feed?");
  const showArtworkUrl = childAttribute(channel, "itunes:image", "href");
  const episodes = children(channel, "item")
    .map((item) => toEpisode(item, showArtworkUrl))
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  assertUniqueAddresses(episodes);
  return episodes;
}

// Each Episode's address must be its own, or a page would be lost (ADR 0002).
function assertUniqueAddresses(episodes: Episode[]): void {
  const seen = new Map<string, Episode>();
  for (const episode of episodes) {
    const path = episodePath(episode);
    const first = seen.get(path);
    if (first) {
      throw new Error(
        episode.type === "full"
          ? `Feed has two full Episodes numbered ${episode.number}: "${first.title}" and "${episode.title}"`
          : `Feed has two Episodes at ${path}: "${first.title}" and "${episode.title}"`
      );
    }
    seen.set(path, episode);
  }
}

// What the player needs of an Episode, to play it and to name and link it
// while it plays. It leaves out the Show notes, so a Play button sends the
// browser little.
export type PlayableEpisode = Episode extends infer E
  ? E extends Episode
    ? Omit<E, "publishedAt" | "showNotesHtml" | "excerpt" | "transcriptUrl">
    : never
  : never;

// The Episode's page on the site.
export function episodePath(episode: PlayableEpisode): string {
  return ["/episodes", ...episodeAddress(episode)].join("/");
}

// The segments of the Episode's page under /episodes: ["4"], or ["bonus",
// "<slug>"] for an unnumbered Episode.
export function episodeAddress(episode: PlayableEpisode): string[] {
  switch (episode.type) {
    case "full":
      return [String(episode.number)];
    case "bonus":
    case "trailer":
      return ["bonus", episode.slug];
    default: {
      const unhandled: never = episode;
      return unhandled;
    }
  }
}

// An Episode with the ones published just before and after it, for the
// Episode page's previous and next links.
export type EpisodeInSequence = {
  episode: Episode;
  previous: Episode | undefined;
  next: Episode | undefined;
};

// The Episode at an address under /episodes, among Episodes newest first.
export function findEpisode(
  episodes: readonly Episode[],
  address: readonly string[]
): EpisodeInSequence | undefined {
  const wanted = address.join("/");
  const index = episodes.findIndex(
    (episode) => episodeAddress(episode).join("/") === wanted
  );
  if (index === -1) return undefined;
  return {
    episode: episodes[index],
    previous: episodes[index + 1],
    next: episodes[index - 1],
  };
}

function toEpisode(item: Element, showArtworkUrl: string | undefined): Episode {
  const guid = childText(item, "guid");
  const rawTitle = childText(item, "title");
  const episodeLabel = rawTitle ? `"${rawTitle}"` : `with guid "${guid ?? ""}"`;
  const required = (field: string, value: string | undefined): string => {
    if (!value)
      throw new Error(`Feed Episode ${episodeLabel} is missing its ${field}`);
    return value;
  };

  const title = required("title", rawTitle);
  const showNotesHtml = sanitizeShowNotes(
    required("Show notes", childText(item, "description"))
  );
  const details: EpisodeDetails = {
    guid: required("guid", guid),
    title,
    publishedAt: publishDate(
      episodeLabel,
      required("publish date", childText(item, "pubDate"))
    ),
    durationSeconds: duration(
      episodeLabel,
      required("duration", childText(item, "itunes:duration"))
    ),
    audioUrl: required("audio URL", childAttribute(item, "enclosure", "url")),
    showNotesHtml,
    excerpt: excerpt(showNotesHtml),
    artworkUrl: required(
      "artwork",
      childAttribute(item, "itunes:image", "href") ?? showArtworkUrl
    ),
    transcriptUrl:
      children(item, "podcast:transcript")
        .filter((t) => getAttributeValue(t, "type") === "text/vtt")
        .map((t) => getAttributeValue(t, "url"))[0] ?? null,
  };
  const type = episodeType(episodeLabel, childText(item, "itunes:episodeType"));
  return type === "full"
    ? { ...details, type, number: episodeNumber(item, episodeLabel) }
    : { ...details, type, slug: slug(episodeLabel, title) };
}

// A missing itunes:episodeType means full, as Apple Podcasts reads it.
function episodeType(episodeLabel: string, value = "full"): EpisodeType {
  const type = EPISODE_TYPES.find((t) => t === value);
  if (!type) {
    throw new Error(
      `Feed Episode ${episodeLabel} has type "${value}"; expected full, bonus, or trailer`
    );
  }
  return type;
}

// Show notes are written on Spreaker and shown as-is, minus anything beyond
// simple formatting. Every link opens in a new tab without access to the site.
function sanitizeShowNotes(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "a", "em", "strong", "i", "b", "ul", "ol", "li"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: LINK_SCHEMES,
    transformTags: {
      a: (tagName, { href = "" }) => ({ tagName, attribs: safeLink(href) }),
    },
  });
}

// Checks the scheme itself (sanitize-html would only drop the href) so an
// unsafe link loses target and rel too, leaving plain text.
function safeLink(href: string): sanitizeHtml.Attributes {
  const safe = LINK_SCHEMES.some((scheme) =>
    href.trim().toLowerCase().startsWith(`${scheme}:`)
  );
  return safe ? { href, target: "_blank", rel: "noopener noreferrer" } : {};
}

const LINK_SCHEMES = ["http", "https", "mailto"];

const EXCERPT_LENGTH = 200;

// Plain text for the archive's short preview, cut at a word boundary.
function excerpt(showNotesHtml: string): string {
  // Space out the line and block breaks so their words don't run together.
  const spaced = showNotesHtml.replace(/<(br|\/p|\/li)\b[^>]*>/g, " $&");
  const text = textContent(parseDocument(spaced)).replace(/\s+/g, " ").trim();
  if (text.length <= EXCERPT_LENGTH) return text;
  const cut = text.slice(0, EXCERPT_LENGTH - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
}

function publishDate(episodeLabel: string, value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(
      `Feed Episode ${episodeLabel} has a publish date that isn't a date: "${value}"`
    );
  }
  return date;
}

// itunes:duration is whole seconds, or [[HH:]MM:]SS.
function duration(episodeLabel: string, value: string): number {
  if (!/^\d+(:\d{1,2}){0,2}$/.test(value)) {
    throw new Error(
      `Feed Episode ${episodeLabel} has a duration that isn't a length of time: "${value}"`
    );
  }
  return value.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}

function episodeNumber(item: Element, episodeLabel: string): number {
  const value = childText(item, "itunes:episode");
  if (!value) {
    throw new Error(
      `Feed Episode ${episodeLabel} is a full Episode with no number`
    );
  }
  if (!/^\d+$/.test(value)) {
    throw new Error(
      `Feed Episode ${episodeLabel} has an Episode number that isn't a whole number: "${value}"`
    );
  }
  return Number(value);
}

function slug(episodeLabel: string, title: string): string {
  const value = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f'’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!value) {
    throw new Error(
      `Feed Episode ${episodeLabel} has no letters or digits in its title to make its address from`
    );
  }
  return value;
}

function children(parent: Element, name: string): Element[] {
  return getElementsByTagName(name, parent.children, false);
}

function childText(parent: Element, name: string): string | undefined {
  const [child] = children(parent, name);
  return child && textContent(child).trim();
}

function childAttribute(
  parent: Element,
  name: string,
  attribute: string
): string | undefined {
  const [child] = children(parent, name);
  return child && getAttributeValue(child, attribute);
}
