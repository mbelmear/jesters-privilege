// Spotify's Episode Listen links (docs/spec.md, Feed and Episodes): the
// Spotify Web API lists the show's episodes, and each Episode is matched to
// one on its title and release date, since Spotify doesn't give the feed's
// GUID. Asking needs a client-credentials key (docs/deploy.md).
import { downloadText, errorMessage, type Fetch } from "./download";
import type { AppLookup } from "./episode-listen-links";
import type { Episode } from "./feed";

export type SpotifyCredentials = { clientId: string; clientSecret: string };

// The build's Spotify key, from the GitHub secrets the deploy passes in. A
// build with neither (a fork, a local build, CI's tests) skips the lookup
// quietly; one with only one has a mistake to name.
export type SpotifyKey =
  | { kind: "set"; credentials: SpotifyCredentials }
  | { kind: "none" }
  | { kind: "incomplete"; reason: string };

export function spotifyKey(env: {
  SPOTIFY_CLIENT_ID?: string;
  SPOTIFY_CLIENT_SECRET?: string;
}): SpotifyKey {
  const clientId = env.SPOTIFY_CLIENT_ID ?? "";
  const clientSecret = env.SPOTIFY_CLIENT_SECRET ?? "";
  if (clientId && clientSecret) {
    return { kind: "set", credentials: { clientId, clientSecret } };
  }
  if (!clientId && !clientSecret) return { kind: "none" };
  const missing = clientId ? "SPOTIFY_CLIENT_SECRET" : "SPOTIFY_CLIENT_ID";
  return {
    kind: "incomplete",
    reason: `${missing} isn't set, so Spotify can't be asked`,
  };
}

const TOKEN_URL = "https://accounts.spotify.com/api/token";

// Never throws: a failed lookup leaves every Episode linking to the show.
// Without a key there's no lookup at all (undefined), as for an app with none.
export async function lookUpSpotify(
  showUrl: string,
  key: SpotifyKey,
  episodes: readonly Pick<Episode, "guid" | "title" | "publishedAt">[],
  fetch: Fetch
): Promise<AppLookup | undefined> {
  switch (key.kind) {
    case "none":
      return undefined;
    case "incomplete":
      return { kind: "failed", reason: key.reason };
    case "set":
      try {
        const showId = spotifyShowId(showUrl);
        const token = await requestToken(key.credentials, fetch);
        const listed = await listShowEpisodes(showId, token, fetch);
        return { kind: "found", episodes: matchEpisodes(episodes, listed) };
      } catch (error: unknown) {
        return { kind: "failed", reason: errorMessage(error) };
      }
    default: {
      const unhandled: never = key;
      throw new Error(`Unknown Spotify key ${JSON.stringify(unhandled)}`);
    }
  }
}

function spotifyShowId(showUrl: string): string {
  const id = /\/show\/([A-Za-z0-9]+)(?:[/?#]|$)/.exec(showUrl)?.[1];
  if (!id) {
    throw new Error(
      `Spotify show link ${showUrl} has no show id (…/show/<id>)`
    );
  }
  return id;
}

async function requestToken(
  { clientId, clientSecret }: SpotifyCredentials,
  fetch: Fetch
): Promise<string> {
  const text = await downloadText("Spotify token", TOKEN_URL, fetch, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const value = parseJson(text, "Spotify token");
  if (!isObject(value) || typeof value.access_token !== "string") {
    throw new Error("Spotify token answer has no access_token");
  }
  return value.access_token;
}

// One of the show's episodes as Spotify lists it, dated by day (YYYY-MM-DD).
type SpotifyEpisode = { name: string; releaseDay: string; link: string };

// Spotify's US catalog: with a client-credentials token there's no listener's
// country, and without a market Spotify counts every episode unavailable.
const MARKET = "US";
// Spotify's most episodes per page.
const PAGE_SIZE = 50;

// Every page of the show's episodes, following each page's next link.
async function listShowEpisodes(
  showId: string,
  token: string,
  fetch: Fetch
): Promise<SpotifyEpisode[]> {
  const episodes: SpotifyEpisode[] = [];
  const seen = new Set<string>();
  let url: string | null =
    `https://api.spotify.com/v1/shows/${showId}/episodes?market=${MARKET}&limit=${PAGE_SIZE}`;
  while (url !== null) {
    if (seen.has(url)) {
      throw new Error(
        `Spotify lookup's next link ${url} repeats an earlier page`
      );
    }
    seen.add(url);
    const text = await downloadText("Spotify lookup", url, fetch, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const page = parsePage(parseJson(text, "Spotify lookup"));
    episodes.push(...page.episodes);
    url = page.next;
  }
  return episodes;
}

function parsePage(value: unknown): {
  episodes: SpotifyEpisode[];
  next: string | null;
} {
  if (!isObject(value) || !Array.isArray(value.items)) {
    throw new Error("Spotify lookup has no list of items");
  }
  const { next } = value;
  if (next !== null && typeof next !== "string") {
    throw new Error("Spotify lookup's next link is neither a URL nor null");
  }
  const items: unknown[] = value.items;
  return { episodes: items.flatMap(parseEpisode), next };
}

// An episode dated only by month or year (release_date_precision) can't be
// matched on its day, so it's left out, as is a null entry, which Spotify's
// docs don't rule out in place of an episode it can't show.
function parseEpisode(item: unknown): SpotifyEpisode[] {
  if (item === null) return [];
  if (
    isObject(item) &&
    typeof item.name === "string" &&
    typeof item.release_date === "string" &&
    isObject(item.external_urls) &&
    typeof item.external_urls.spotify === "string"
  ) {
    if (item.release_date_precision !== "day") return [];
    return [
      {
        name: item.name,
        releaseDay: item.release_date,
        link: item.external_urls.spotify,
      },
    ];
  }
  throw new Error(
    "Spotify lookup has an episode without name, release_date, or external_urls.spotify"
  );
}

// Spotify dates an episode by day with no time zone, while the feed gives the
// moment it was published, so an episode dated the Episode's UTC day or a day
// either side matches, the nearest winning.
const MAX_DAYS_APART = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

function matchEpisodes(
  episodes: readonly Pick<Episode, "guid" | "title" | "publishedAt">[],
  listed: readonly SpotifyEpisode[]
): Map<string, string> {
  const found = new Map<string, string>();
  for (const episode of episodes) {
    const published = Date.parse(
      episode.publishedAt.toISOString().slice(0, 10)
    );
    const nearest = listed
      .filter((s) => s.name === episode.title)
      .map((s) => ({
        link: s.link,
        daysApart: Math.abs(Date.parse(s.releaseDay) - published) / DAY_MS,
      }))
      .filter(({ daysApart }) => daysApart <= MAX_DAYS_APART)
      .sort((a, b) => a.daysApart - b.daysApart)[0];
    if (nearest) found.set(episode.guid, nearest.link);
  }
  return found;
}

function parseJson(text: string, what: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${what} answer isn't JSON`);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
