// Plain data a content file can hold: what findDrafts and validateContent walk.
export type ContentValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly ContentValue[]
  | { readonly [key: string]: ContentValue };

type ContentRecord = { readonly [key: string]: ContentValue };

// Copy still awaiting the Jesters' own words: shown on previews under a DRAFT
// ribbon, and refused by the launch check.
type Draftable = { readonly draft?: true };

export type Copy = { readonly text: string } & Draftable;

export type Section = {
  readonly title: string;
  readonly paragraphs: readonly string[];
} & Draftable;

export const LISTEN_PLATFORMS = [
  "apple-podcasts",
  "spotify",
  "youtube",
  "rss",
] as const;
export type ListenPlatform = (typeof LISTEN_PLATFORMS)[number];

export const SOCIAL_NETWORKS = [
  "instagram",
  "facebook",
  "tiktok",
  "x",
] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

// Every link is optional: each appears on the site as soon as it's filled in.
export type Site = {
  readonly name: string;
  readonly tagline: string;
  readonly description: Copy;
  readonly contactEmail: string;
  readonly listen: { readonly [P in ListenPlatform]?: string };
  readonly social: { readonly [N in SocialNetwork]?: string };
};

export const JESTER_IDS = ["michael", "dan", "aaron"] as const;
export type JesterId = (typeof JESTER_IDS)[number];

export type Photo = { readonly src: string; readonly alt: string };

// A missing photo shows the monogram shield; a missing bio, name and role only.
export type Jester = {
  readonly id: JesterId;
  readonly name: string;
  readonly role: "Pastor" | "Deacon" | "Producer";
  readonly bio?: Copy;
  readonly photo?: Photo;
};

// Fractions of the painting's width and height (0 to 1) to keep in view when
// it's cropped on a phone.
export type FocalPoint = { readonly x: number; readonly y: number };

export type Painting = {
  readonly src: string;
  // The Wikimedia Commons file page recording its public-domain status.
  readonly source: string;
  readonly alt: string;
  readonly focalPoint: FocalPoint;
  readonly placard: {
    readonly artist: string;
    readonly title: string;
    readonly year: string;
    readonly medium: string;
    readonly collection: string;
  };
};

export const ERA_IDS = [
  "holy-fools",
  "medieval-court",
  "renaissance",
  "reformation",
] as const;
export type EraId = (typeof ERA_IDS)[number];

export type Era = {
  readonly id: EraId;
  readonly title: string;
  readonly period: string;
  readonly intro: Section;
  // The painting band that opens the era, once one is sourced.
  readonly band?: Painting;
};

export type Fool = {
  readonly slug: string;
  readonly name: string;
  readonly era: EraId;
  readonly lived: string;
  readonly story: Section;
  readonly painting: Painting;
};

export type Gallery = {
  readonly eras: readonly Era[];
  readonly fools: readonly Fool[];
  // Why this show wears the motley.
  readonly closing: Section;
};

export type About = {
  readonly whyAJester: Section;
  readonly whatWeBelieve: Section;
  readonly church: Section;
  readonly howToListen: Section;
};

export type Content = {
  readonly site: Site;
  readonly hero: { readonly paragraphs: readonly string[] };
  readonly jesters: readonly Jester[];
  readonly gallery: Gallery;
  readonly about: About;
  readonly microcopy: { readonly [key: string]: Copy };
};

// Where each piece of draft content sits, as a path such as
// "jesters[dan].bio". List items are named by their id or slug.
export function findDrafts(value: ContentValue): string[] {
  return [...nodes(value)]
    .filter(([, node]) => isRecord(node) && node.draft === true)
    .map(([path]) => path);
}

// Throws, failing the build, when content breaks a rule, naming where it is
// and the rule; otherwise returns it unchanged.
export function validateContent<C extends Content>(content: C): C {
  for (const [path, value] of nodes(content)) {
    if (typeof value === "string" && value.trim() === "") {
      throw new Error(`Content ${path} is empty`);
    }
    if (isList(value)) assertUniqueNames(path, value);
  }
  const { listen, social } = content.site;
  for (const [path, links] of [
    ["site.listen", listen],
    ["site.social", social],
  ] as const) {
    for (const [name, link] of Object.entries(links)) {
      if (link !== undefined) assertHttpsUrl(`${path}.${name}`, link);
    }
  }
  const { eras, fools } = content.gallery;
  for (const era of eras) {
    if (era.band) assertPainting(`gallery.eras[${era.id}].band`, era.band);
  }
  for (const fool of fools) {
    const path = `gallery.fools[${fool.slug}]`;
    if (!eras.some((era) => era.id === fool.era)) {
      throw new Error(
        `Content ${path}.era is "${fool.era}", which isn't one of the Gallery's eras`
      );
    }
    assertPainting(`${path}.painting`, fool.painting);
  }
  return content;
}

function assertPainting(path: string, painting: Painting): void {
  const { x, y } = painting.focalPoint;
  if (![x, y].every((fraction) => fraction >= 0 && fraction <= 1)) {
    throw new Error(
      `Content ${path}.focalPoint must lie within the painting (x and y from 0 to 1), not (${x}, ${y})`
    );
  }
  const source = URL.parse(painting.source);
  if (
    source?.protocol !== "https:" ||
    source.hostname !== "commons.wikimedia.org" ||
    !source.pathname.startsWith("/wiki/File:")
  ) {
    throw new Error(
      `Content ${path}.source must be a Wikimedia Commons file page recording its public-domain status, not "${painting.source}"`
    );
  }
}

// A Jester's id or a Fool's slug names their item, and a Fool's slug their
// address, so two items can't share one.
function assertUniqueNames(path: string, items: readonly ContentValue[]): void {
  const seen = new Set<string>();
  for (const [index, item] of items.entries()) {
    const name = itemName(item, index);
    if (seen.has(name)) {
      throw new Error(`Content ${path} has two items named "${name}"`);
    }
    seen.add(name);
  }
}

function assertHttpsUrl(path: string, value: string): void {
  if (URL.parse(value)?.protocol !== "https:") {
    throw new Error(`Content ${path} must be an https URL, not "${value}"`);
  }
}

// Every value in the content, with its path.
function* nodes(
  value: ContentValue,
  path = ""
): Generator<[string, ContentValue]> {
  yield [path, value];
  if (isList(value)) {
    for (const [index, item] of value.entries()) {
      yield* nodes(item, `${path}[${itemName(item, index)}]`);
    }
  } else if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      yield* nodes(child, path ? `${path}.${key}` : key);
    }
  }
}

function itemName(item: ContentValue, index: number): string {
  if (isRecord(item)) {
    const name = item.id ?? item.slug;
    if (typeof name === "string") return name;
  }
  return String(index);
}

function isList(value: ContentValue): value is readonly ContentValue[] {
  return Array.isArray(value);
}

function isRecord(value: ContentValue): value is ContentRecord {
  return typeof value === "object" && value !== null && !isList(value);
}
