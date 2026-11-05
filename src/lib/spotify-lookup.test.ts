import type { FetchInit, TextResponse } from "./download";
import { lookUpSpotify, spotifyKey } from "./spotify-lookup";

const SHOW = "https://open.spotify.com/show/6a7KnKe6ohzrMGZwJDc5Ti";
const CREDENTIALS = { clientId: "the-id", clientSecret: "the-secret" };
const KEY = { kind: "set", credentials: CREDENTIALS } as const;
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const EPISODES_URL =
  "https://api.spotify.com/v1/shows/6a7KnKe6ohzrMGZwJDc5Ti/episodes?market=US&limit=50";

// Episode 1 as the feed has it: published 2026-11-03 at 20:22 UTC.
const CELEBRITY_PASTORS = {
  guid: "https://api.spreaker.com/episode/76161078",
  title: "Celebrity Pastors",
  publishedAt: new Date("2026-11-03T20:22:01Z"),
};

// An episode as Spotify's Get Show Episodes lists it, cut to the fields the
// lookup reads.
function spotifyEpisode(
  name: string,
  releaseDate: string,
  id: string,
  precision = "day"
) {
  return {
    id,
    name,
    release_date: releaseDate,
    release_date_precision: precision,
    external_urls: { spotify: `https://open.spotify.com/episode/${id}` },
  };
}

function page(items: unknown[], next: string | null = null) {
  return JSON.stringify({ items, next, total: items.length });
}

type Request = { url: string; init?: FetchInit };

function response(body: string, status = 200): TextResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Unauthorized",
    text: async () => body,
  };
}

// A Spotify that hands out a token and answers each episodes URL with its
// page, recording every request.
function spotify(pages: Record<string, string>) {
  const requests: Request[] = [];
  const fetch = async (
    url: string,
    init?: FetchInit
  ): Promise<TextResponse> => {
    requests.push({ url, init });
    if (url === TOKEN_URL) {
      return response(
        JSON.stringify({
          access_token: "the-token",
          token_type: "bearer",
          expires_in: 3600,
        })
      );
    }
    const body = pages[url];
    return body === undefined ? response("", 404) : response(body);
  };
  return { fetch, requests };
}

describe("lookUpSpotify", () => {
  it("asks for a client-credentials token, then for the show's episodes with it", async () => {
    const { fetch, requests } = spotify({ [EPISODES_URL]: page([]) });
    await lookUpSpotify(SHOW, KEY, [CELEBRITY_PASTORS], fetch);
    expect(requests).toEqual([
      {
        url: TOKEN_URL,
        init: {
          method: "POST",
          headers: {
            // base64 of "the-id:the-secret"
            Authorization: "Basic dGhlLWlkOnRoZS1zZWNyZXQ=",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: "grant_type=client_credentials",
        },
      },
      {
        url: EPISODES_URL,
        init: { headers: { Authorization: "Bearer the-token" } },
      },
    ]);
  });

  it("finds the Episode's page in Spotify by its title and release date", async () => {
    const { fetch } = spotify({
      [EPISODES_URL]: page([
        spotifyEpisode("Celebrity Pastors", "2026-11-03", "4xRk1d"),
      ]),
    });
    expect(await lookUpSpotify(SHOW, KEY, [CELEBRITY_PASTORS], fetch)).toEqual({
      kind: "found",
      episodes: new Map([
        [CELEBRITY_PASTORS.guid, "https://open.spotify.com/episode/4xRk1d"],
      ]),
    });
  });
});

describe("lookUpSpotify's failures", () => {
  // A Spotify that answers the token request and the episodes request as
  // given.
  function answering(token: () => Promise<TextResponse>, episodes: string) {
    return async (url: string): Promise<TextResponse> =>
      url === TOKEN_URL ? token() : response(episodes);
  }
  const goodToken = async () =>
    response(JSON.stringify({ access_token: "the-token" }));

  it.each([
    [
      "refuses the key",
      answering(async () => response("", 401), page([])),
      `Spotify token ${TOKEN_URL} answered 401 Unauthorized`,
    ],
    [
      "can't be reached",
      answering(async () => {
        throw new Error("getaddrinfo ENOTFOUND accounts.spotify.com");
      }, page([])),
      `Spotify token ${TOKEN_URL} couldn't be reached: getaddrinfo ENOTFOUND accounts.spotify.com`,
    ],
    [
      "hands out no token",
      answering(
        async () => response(JSON.stringify({ error: "invalid_client" })),
        page([])
      ),
      "Spotify token answer has no access_token",
    ],
    [
      "answers the token request with something other than JSON",
      answering(async () => response("<!doctype html>"), page([])),
      "Spotify token answer isn't JSON",
    ],
    [
      "answers the lookup with something other than JSON",
      answering(goodToken, "<!doctype html>"),
      "Spotify lookup answer isn't JSON",
    ],
    [
      "answers the lookup without items",
      answering(goodToken, JSON.stringify({ error: { status: 404 } })),
      "Spotify lookup has no list of items",
    ],
    [
      "lists an episode without its link",
      answering(
        goodToken,
        page([
          {
            name: "Celebrity Pastors",
            release_date: "2026-11-03",
            release_date_precision: "day",
          },
        ])
      ),
      "Spotify lookup has an episode without name, release_date, or external_urls.spotify",
    ],
  ])("fails without throwing when Spotify %s", async (_, fetch, reason) => {
    expect(await lookUpSpotify(SHOW, KEY, [CELEBRITY_PASTORS], fetch)).toEqual({
      kind: "failed",
      reason,
    });
  });

  it("fails without asking Spotify when the show link has no show id", async () => {
    const { fetch, requests } = spotify({});
    expect(
      await lookUpSpotify(
        "https://open.spotify.com/",
        KEY,
        [CELEBRITY_PASTORS],
        fetch
      )
    ).toEqual({
      kind: "failed",
      reason:
        "Spotify show link https://open.spotify.com/ has no show id (…/show/<id>)",
    });
    expect(requests).toEqual([]);
  });

  it("skips an episode Spotify lists as null and matches the rest", async () => {
    const { fetch } = spotify({
      [EPISODES_URL]: page([
        null,
        spotifyEpisode("Celebrity Pastors", "2026-11-03", "4xRk1d"),
      ]),
    });
    expect(await lookUpSpotify(SHOW, KEY, [CELEBRITY_PASTORS], fetch)).toEqual({
      kind: "found",
      episodes: new Map([
        [CELEBRITY_PASTORS.guid, "https://open.spotify.com/episode/4xRk1d"],
      ]),
    });
  });
});

describe("lookUpSpotify without a whole key", () => {
  it("skips the lookup, asking nothing, when the build has no key", async () => {
    const { fetch, requests } = spotify({});
    expect(
      await lookUpSpotify(SHOW, { kind: "none" }, [CELEBRITY_PASTORS], fetch)
    ).toBeUndefined();
    expect(requests).toEqual([]);
  });

  it("fails, asking nothing, when the key is half set", async () => {
    const { fetch, requests } = spotify({});
    const reason = "SPOTIFY_CLIENT_SECRET isn't set, so Spotify can't be asked";
    expect(
      await lookUpSpotify(
        SHOW,
        { kind: "incomplete", reason },
        [CELEBRITY_PASTORS],
        fetch
      )
    ).toEqual({ kind: "failed", reason });
    expect(requests).toEqual([]);
  });
});

describe("lookUpSpotify's paging", () => {
  const SECOND_PAGE =
    "https://api.spotify.com/v1/shows/6a7KnKe6ohzrMGZwJDc5Ti/episodes?offset=50&limit=50&market=US";

  it("follows each page's next link until the last", async () => {
    const older = {
      guid: "https://api.spreaker.com/episode/1",
      title: "The Trailer",
      publishedAt: new Date("2026-10-20T12:00:00Z"),
    };
    const { fetch, requests } = spotify({
      [EPISODES_URL]: page(
        [spotifyEpisode("Celebrity Pastors", "2026-11-03", "newer")],
        SECOND_PAGE
      ),
      [SECOND_PAGE]: page([
        spotifyEpisode("The Trailer", "2026-10-20", "older"),
      ]),
    });
    expect(
      await lookUpSpotify(SHOW, KEY, [CELEBRITY_PASTORS, older], fetch)
    ).toEqual({
      kind: "found",
      episodes: new Map([
        [CELEBRITY_PASTORS.guid, "https://open.spotify.com/episode/newer"],
        [older.guid, "https://open.spotify.com/episode/older"],
      ]),
    });
    expect(requests.map(({ url }) => url)).toEqual([
      TOKEN_URL,
      EPISODES_URL,
      SECOND_PAGE,
    ]);
    expect(requests[2]?.init).toEqual({
      headers: { Authorization: "Bearer the-token" },
    });
  });

  it("fails rather than follow a next link that loops back", async () => {
    const { fetch } = spotify({
      [EPISODES_URL]: page([], SECOND_PAGE),
      [SECOND_PAGE]: page([], EPISODES_URL),
    });
    expect(await lookUpSpotify(SHOW, KEY, [CELEBRITY_PASTORS], fetch)).toEqual({
      kind: "failed",
      reason: `Spotify lookup's next link ${EPISODES_URL} repeats an earlier page`,
    });
  });
});

describe("lookUpSpotify's matching", () => {
  async function linkFor(listed: ReturnType<typeof spotifyEpisode>[]) {
    const { fetch } = spotify({ [EPISODES_URL]: page(listed) });
    const lookup = await lookUpSpotify(SHOW, KEY, [CELEBRITY_PASTORS], fetch);
    if (lookup?.kind !== "found") throw new Error(JSON.stringify(lookup));
    return lookup.episodes.get(CELEBRITY_PASTORS.guid);
  }

  // Spotify gives a day with no time zone, and an Episode published in the
  // Jesters' evening is the next day in UTC.
  it.each(["2026-11-02", "2026-11-04"])(
    "matches an episode Spotify dates a day either side (%s)",
    async (day) => {
      expect(
        await linkFor([spotifyEpisode("Celebrity Pastors", day, "4xRk1d")])
      ).toBe("https://open.spotify.com/episode/4xRk1d");
    }
  );

  it.each([
    [
      "dated two days later",
      spotifyEpisode("Celebrity Pastors", "2026-11-05", "a"),
    ],
    [
      "dated two days earlier",
      spotifyEpisode("Celebrity Pastors", "2026-11-01", "a"),
    ],
    [
      "with another title",
      spotifyEpisode("Celebrity Pastors II", "2026-11-03", "a"),
    ],
    [
      "dated only by month",
      spotifyEpisode("Celebrity Pastors", "2026-11", "a", "month"),
    ],
    [
      "dated only by year",
      spotifyEpisode("Celebrity Pastors", "2026", "a", "year"),
    ],
  ])("doesn't match an episode %s", async (_, listed) => {
    expect(await linkFor([listed])).toBeUndefined();
  });

  it("picks the episode released that day over one a day off", async () => {
    expect(
      await linkFor([
        spotifyEpisode("Celebrity Pastors", "2026-11-04", "next-day"),
        spotifyEpisode("Celebrity Pastors", "2026-11-03", "same-day"),
      ])
    ).toBe("https://open.spotify.com/episode/same-day");
  });
});

describe("spotifyKey", () => {
  it("has the key when both secrets are set", () => {
    expect(
      spotifyKey({
        SPOTIFY_CLIENT_ID: "the-id",
        SPOTIFY_CLIENT_SECRET: "the-secret",
      })
    ).toEqual({ kind: "set", credentials: CREDENTIALS });
  });

  // Forks, local builds, and CI's tests have neither, and skip the lookup.
  it.each([{}, { SPOTIFY_CLIENT_ID: "", SPOTIFY_CLIENT_SECRET: "" }])(
    "has none when neither secret is set (%j)",
    (env) => {
      expect(spotifyKey(env)).toEqual({ kind: "none" });
    }
  );

  // A production build or the feed check has the key since 2026-11-05, so
  // going without means the secrets were deleted or renamed.
  it.each([{}, { SPOTIFY_CLIENT_ID: "", SPOTIFY_CLIENT_SECRET: "" }])(
    "names both secrets when a run that needs the key has neither (%j)",
    (env) => {
      expect(spotifyKey(env, { required: true })).toEqual({
        kind: "incomplete",
        reason:
          "SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET aren't set, so Spotify can't be asked",
      });
    }
  );

  it("has the key when a run that needs it has both secrets", () => {
    expect(
      spotifyKey(
        { SPOTIFY_CLIENT_ID: "the-id", SPOTIFY_CLIENT_SECRET: "the-secret" },
        { required: true }
      )
    ).toEqual({ kind: "set", credentials: CREDENTIALS });
  });

  it.each([
    [{ SPOTIFY_CLIENT_ID: "the-id" }, "SPOTIFY_CLIENT_SECRET"],
    [{ SPOTIFY_CLIENT_SECRET: "the-secret" }, "SPOTIFY_CLIENT_ID"],
  ])("names the missing secret when only one is set (%j)", (env, missing) => {
    expect(spotifyKey(env)).toEqual({
      kind: "incomplete",
      reason: `${missing} isn't set, so Spotify can't be asked`,
    });
  });
});
