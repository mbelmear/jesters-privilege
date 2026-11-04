// Episode Listen links (GLOSSARY: Listen link): on an Episode, a Listen link
// opens that Episode in the app. The build looks each app's Episodes up once,
// and an Episode the app doesn't list, or every Episode when the lookup
// fails, links to the show instead (docs/spec.md, Feed and Episodes).
import type { ListenPlatform, Site } from "./content";
import { downloadText, errorMessage, type Fetch } from "./download";
import type { Episode } from "./feed";

// The apps an Episode can link into, in the order its icons show. RSS is a
// feed, not an app, so it has no Episode Listen link.
export const EPISODE_LISTEN_APPS = [
  "apple-podcasts",
  "spotify",
  "youtube",
] as const satisfies readonly ListenPlatform[];
export type EpisodeListenApp = (typeof EPISODE_LISTEN_APPS)[number];

// How the build log and the feed check name each app.
export const APP_NAMES: Record<EpisodeListenApp, string> = {
  "apple-podcasts": "Apple Podcasts",
  spotify: "Spotify",
  youtube: "YouTube",
};

// What one app's lookup found: each listed Episode's page in the app, by the
// Episode's feed GUID; or why the lookup failed.
export type AppLookup =
  | { kind: "found"; episodes: ReadonlyMap<string, string> }
  | { kind: "failed"; reason: string };

// Each app's lookup. An app with none yet (Spotify until #122, YouTube) links
// every Episode to the show.
export type Lookups = { readonly [A in EpisodeListenApp]?: AppLookup };

export type EpisodeListenLink = { app: EpisodeListenApp; href: string };

// The Episode's Listen link in each app the show is on: the Episode's own page
// where the app's lookup found it, the show's otherwise. `warn` names the
// Episode and the app whenever a found link was expected and is missing.
export function episodeListenLinks(
  episode: Pick<Episode, "guid" | "title">,
  show: Site["listen"],
  lookups: Lookups,
  warn: (message: string) => void
): EpisodeListenLink[] {
  return EPISODE_LISTEN_APPS.flatMap((app) => {
    const showLink = show[app];
    if (!showLink) return [];
    const lookup = lookups[app];
    if (!lookup) return [{ app, href: showLink }];
    const name = APP_NAMES[app];
    const named = `"${episode.title}" (${episode.guid})`;
    switch (lookup.kind) {
      case "found": {
        const href = lookup.episodes.get(episode.guid);
        if (href) return [{ app, href }];
        warn(
          `${name} doesn't list ${named} yet, so its ${name} link opens the show`
        );
        return [{ app, href: showLink }];
      }
      case "failed":
        warn(
          `${name} lookup failed, so ${named} links to the show there: ${lookup.reason}`
        );
        return [{ app, href: showLink }];
      default: {
        const unhandled: never = lookup;
        throw new Error(`Unknown lookup ${JSON.stringify(unhandled)}`);
      }
    }
  });
}

// The feed GUIDs of the Episodes each app had a link for: what the build
// manifest records, so the feed check can rebuild when an Episode gains one.
export type ListedEpisodes = {
  readonly [A in EpisodeListenApp]?: readonly string[];
};

export function listedEpisodes(
  episodes: readonly Pick<Episode, "guid">[],
  lookups: Lookups
): ListedEpisodes {
  const listed: { [A in EpisodeListenApp]?: string[] } = {};
  for (const app of EPISODE_LISTEN_APPS) {
    const lookup = lookups[app];
    if (lookup?.kind !== "found") continue;
    const guids = episodes
      .map(({ guid }) => guid)
      .filter((guid) => lookup.episodes.has(guid));
    if (guids.length > 0) listed[app] = guids;
  }
  return listed;
}

// Each Episode that has a link in `now` it lacked in `before`. An Episode
// that lost one (a lookup that failed this time) isn't counted.
export function gainedListenLinks(
  before: ListedEpisodes,
  now: ListedEpisodes
): { app: EpisodeListenApp; guid: string }[] {
  return EPISODE_LISTEN_APPS.flatMap((app) => {
    const had = new Set(before[app]);
    return (now[app] ?? [])
      .filter((guid) => !had.has(guid))
      .map((guid) => ({ app, guid }));
  });
}

// Apple's lookup answers at most 200 Episodes, newest first; older ones link
// to the show.
const APPLE_LOOKUP_LIMIT = 200;

// Never throws: a failed lookup leaves every Episode linking to the show.
export async function lookUpApple(
  showUrl: string,
  fetch: Fetch
): Promise<AppLookup> {
  try {
    const url = appleLookupUrl(showUrl);
    const text = await downloadText("Apple Podcasts lookup", url, fetch);
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new Error(`Apple Podcasts lookup ${url} isn't JSON`);
    }
    return { kind: "found", episodes: parseAppleLookup(value) };
  } catch (error: unknown) {
    return { kind: "failed", reason: errorMessage(error) };
  }
}

function appleLookupUrl(showUrl: string): string {
  const id = /\/id(\d+)(?:[/?#]|$)/.exec(showUrl)?.[1];
  if (!id) {
    throw new Error(
      `Apple Podcasts show link ${showUrl} has no show id (…/id<digits>)`
    );
  }
  return `https://itunes.apple.com/lookup?id=${id}&entity=podcastEpisode&limit=${APPLE_LOOKUP_LIMIT}`;
}

// Apple's answer: the show, then one result per Episode it lists, each with
// the feed's GUID as `episodeGuid` and its page as `trackViewUrl`.
function parseAppleLookup(value: unknown): Map<string, string> {
  if (!isObject(value) || !("results" in value)) {
    throw new Error("Apple Podcasts lookup has no results");
  }
  const results: unknown = value.results;
  if (!Array.isArray(results)) {
    throw new Error("Apple Podcasts lookup results aren't a list");
  }
  const list: unknown[] = results;
  const episodes = new Map<string, string>();
  for (const result of list) {
    if (!isObject(result) || result.wrapperType !== "podcastEpisode") continue;
    const { episodeGuid, trackViewUrl } = result;
    if (typeof episodeGuid !== "string" || typeof trackViewUrl !== "string") {
      throw new Error(
        "Apple Podcasts lookup has an Episode without episodeGuid or trackViewUrl"
      );
    }
    episodes.set(episodeGuid, withoutTracking(trackViewUrl));
  }
  return episodes;
}

// Apple tags each link with its affiliate marker, uo=4; the site's links go
// without it.
function withoutTracking(link: string): string {
  const url = new URL(link);
  url.searchParams.delete("uo");
  return url.toString();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
