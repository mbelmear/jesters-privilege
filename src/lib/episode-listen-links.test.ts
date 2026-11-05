import type { TextResponse } from "./download";
import {
  episodeListenLinks,
  gainedListenLinks,
  listedEpisodes,
  lookUpApple,
  parseLookups,
  serializeLookups,
} from "./episode-listen-links";

const SHOW =
  "https://podcasts.apple.com/us/podcast/jesters-privilege/id6830338936";

// Apple's answer for the show on 2026-11-04, cut to the fields the lookup
// reads: the show itself, then Celebrity Pastors.
const lookupAnswer = {
  resultCount: 2,
  results: [
    {
      wrapperType: "track",
      kind: "podcast",
      collectionId: 6830338936,
      trackViewUrl:
        "https://podcasts.apple.com/us/podcast/jesters-privilege/id6830338936?uo=4",
    },
    {
      wrapperType: "podcastEpisode",
      kind: "podcast-episode",
      episodeGuid: "https://api.spreaker.com/episode/76161078",
      trackId: 1000799664710,
      trackName: "Celebrity Pastors",
      trackViewUrl:
        "https://podcasts.apple.com/us/podcast/celebrity-pastors/id6830338936?i=1000799664710&uo=4",
    },
  ],
};

function answering(body: string, status = 200) {
  const urls: string[] = [];
  const fetch = async (url: string): Promise<TextResponse> => {
    urls.push(url);
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : "Service Unavailable",
      text: async () => body,
    };
  };
  return { fetch, urls };
}

describe("lookUpApple", () => {
  it("asks Apple for the show's Episodes by the show's id", async () => {
    const { fetch, urls } = answering(JSON.stringify(lookupAnswer));
    await lookUpApple(SHOW, fetch);
    expect(urls).toEqual([
      "https://itunes.apple.com/lookup?id=6830338936&entity=podcastEpisode&limit=200",
    ]);
  });

  it("finds each Episode's page in Apple Podcasts by its feed GUID", async () => {
    const { fetch } = answering(JSON.stringify(lookupAnswer));
    expect(await lookUpApple(SHOW, fetch)).toEqual({
      kind: "found",
      episodes: new Map([
        [
          "https://api.spreaker.com/episode/76161078",
          "https://podcasts.apple.com/us/podcast/celebrity-pastors/id6830338936?i=1000799664710",
        ],
      ]),
    });
  });

  it.each([
    [
      "answers with an error",
      answering("", 503).fetch,
      "Apple Podcasts lookup https://itunes.apple.com/lookup?id=6830338936&entity=podcastEpisode&limit=200 answered 503 Service Unavailable",
    ],
    [
      "can't be reached",
      async (): Promise<TextResponse> => {
        throw new Error("getaddrinfo ENOTFOUND itunes.apple.com");
      },
      "Apple Podcasts lookup https://itunes.apple.com/lookup?id=6830338936&entity=podcastEpisode&limit=200 couldn't be reached: getaddrinfo ENOTFOUND itunes.apple.com",
    ],
    [
      "answers with something other than JSON",
      answering("<!doctype html>").fetch,
      "Apple Podcasts lookup https://itunes.apple.com/lookup?id=6830338936&entity=podcastEpisode&limit=200 isn't JSON",
    ],
    [
      "answers JSON without results",
      answering(JSON.stringify({ errorMessage: "Invalid value(s)" })).fetch,
      "Apple Podcasts lookup has no results",
    ],
    [
      "lists an Episode without its GUID",
      answering(
        JSON.stringify({
          results: [
            {
              wrapperType: "podcastEpisode",
              trackViewUrl: "https://podcasts.apple.com/us/podcast/x/id1?i=2",
            },
          ],
        })
      ).fetch,
      "Apple Podcasts lookup has an Episode without episodeGuid or trackViewUrl",
    ],
  ])("fails without throwing when Apple %s", async (_, fetch, reason) => {
    expect(await lookUpApple(SHOW, fetch)).toEqual({ kind: "failed", reason });
  });

  it("fails without asking Apple when the show link has no show id", async () => {
    const { fetch, urls } = answering(JSON.stringify(lookupAnswer));
    expect(
      await lookUpApple("https://podcasts.apple.com/us/podcast/jesters", fetch)
    ).toEqual({
      kind: "failed",
      reason:
        "Apple Podcasts show link https://podcasts.apple.com/us/podcast/jesters has no show id (…/id<digits>)",
    });
    expect(urls).toEqual([]);
  });
});

describe("episodeListenLinks", () => {
  const show = {
    "apple-podcasts": SHOW,
    spotify: "https://open.spotify.com/show/6a7KnKe6ohzrMGZwJDc5Ti",
  };
  const celebrityPastors = {
    guid: "https://api.spreaker.com/episode/76161078",
    title: "Celebrity Pastors",
  };
  const found = {
    "apple-podcasts": {
      kind: "found",
      episodes: new Map([
        [
          celebrityPastors.guid,
          "https://podcasts.apple.com/us/podcast/celebrity-pastors/id6830338936?i=1000799664710",
        ],
      ]),
    },
  } as const;

  it("opens the Episode in each app that lists it, and the show in the rest", () => {
    const warn = jest.fn();
    expect(episodeListenLinks(celebrityPastors, show, found, warn)).toEqual([
      {
        app: "apple-podcasts",
        href: "https://podcasts.apple.com/us/podcast/celebrity-pastors/id6830338936?i=1000799664710",
      },
      // No Spotify lookup (a build without the key), so its link opens the show.
      { app: "spotify", href: show.spotify },
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("opens the show in an app that doesn't list the Episode yet, and says so", () => {
    const warn = jest.fn();
    const newest = {
      guid: "https://api.spreaker.com/episode/76999999",
      title: "Is Humor a Virtue?",
    };
    expect(episodeListenLinks(newest, show, found, warn)).toEqual([
      { app: "apple-podcasts", href: SHOW },
      { app: "spotify", href: show.spotify },
    ]);
    expect(warn).toHaveBeenCalledWith(
      'Apple Podcasts doesn\'t list "Is Humor a Virtue?" (https://api.spreaker.com/episode/76999999) yet, so its Apple Podcasts link opens the show'
    );
  });

  it("opens the show when the app's lookup failed, and says why", () => {
    const warn = jest.fn();
    const failed = {
      "apple-podcasts": {
        kind: "failed",
        reason: "Apple Podcasts lookup answered 503",
      },
    } as const;
    expect(episodeListenLinks(celebrityPastors, show, failed, warn)).toEqual([
      { app: "apple-podcasts", href: SHOW },
      { app: "spotify", href: show.spotify },
    ]);
    expect(warn).toHaveBeenCalledWith(
      'Apple Podcasts lookup failed, so "Celebrity Pastors" (https://api.spreaker.com/episode/76161078) links to the show there: Apple Podcasts lookup answered 503'
    );
  });

  it("leaves out an app the show isn't on, even if a lookup found the Episode", () => {
    expect(
      episodeListenLinks(
        celebrityPastors,
        { spotify: show.spotify },
        found,
        jest.fn()
      )
    ).toEqual([{ app: "spotify", href: show.spotify }]);
  });

  it("has nothing to link before the show is on any app", () => {
    expect(episodeListenLinks(celebrityPastors, {}, found, jest.fn())).toEqual(
      []
    );
  });
});

describe("listedEpisodes", () => {
  const guids = [
    "https://api.spreaker.com/episode/2",
    "https://api.spreaker.com/episode/1",
  ];
  const episodes = guids.map((guid) => ({ guid }));

  it("records the feed's Episodes each app had a link for, in feed order", () => {
    const lookups = {
      "apple-podcasts": {
        kind: "found",
        episodes: new Map([
          [guids[1], "https://podcasts.apple.com/x?i=1"],
          [guids[0], "https://podcasts.apple.com/x?i=2"],
          // An Episode Apple lists that the feed no longer has.
          [
            "https://api.spreaker.com/episode/0",
            "https://podcasts.apple.com/x?i=0",
          ],
        ]),
      },
    } as const;
    expect(listedEpisodes(episodes, lookups)).toEqual({
      "apple-podcasts": guids,
    });
  });

  it("records nothing for an app whose lookup failed or that has none", () => {
    expect(
      listedEpisodes(episodes, {
        "apple-podcasts": { kind: "failed", reason: "answered 503" },
      })
    ).toEqual({});
  });
});

describe("gainedListenLinks", () => {
  const one = "https://api.spreaker.com/episode/1";
  const two = "https://api.spreaker.com/episode/2";

  it("names each Episode that has a link it didn't have before", () => {
    expect(
      gainedListenLinks(
        { "apple-podcasts": [one] },
        { "apple-podcasts": [two, one], spotify: [one] }
      )
    ).toEqual([
      { app: "apple-podcasts", guid: two },
      { app: "spotify", guid: one },
    ]);
  });

  it("finds nothing gained when the links are the same, or fewer", () => {
    expect(
      gainedListenLinks(
        { "apple-podcasts": [two, one] },
        { "apple-podcasts": [two, one] }
      )
    ).toEqual([]);
    expect(gainedListenLinks({ "apple-podcasts": [two, one] }, {})).toEqual([]);
  });
});

describe("serializeLookups and parseLookups", () => {
  // The build looks the apps up once and every page reads the same answer.
  it("hand every page the lookups the build made, found or failed", () => {
    const lookups = {
      "apple-podcasts": {
        kind: "found",
        episodes: new Map([
          [
            "https://api.spreaker.com/episode/76161078",
            "https://podcasts.apple.com/us/podcast/celebrity-pastors/id6830338936?i=1000799664710",
          ],
        ]),
      },
      spotify: { kind: "failed", reason: "Spotify lookup answered 503" },
    } as const;
    expect(
      parseLookups(JSON.parse(JSON.stringify(serializeLookups(lookups))))
    ).toEqual(lookups);
  });

  it.each([
    ["isn't an object", "[]"],
    ["names an app it doesn't know", '{"rss":{"kind":"failed","reason":"x"}}'],
    ["has a lookup of an unknown kind", '{"spotify":{"kind":"maybe"}}'],
    ["has a failure without its reason", '{"spotify":{"kind":"failed"}}'],
    [
      "has Episodes that aren't GUID and link pairs",
      '{"apple-podcasts":{"kind":"found","episodes":[["only-a-guid"]]}}',
    ],
  ])("refuses a snapshot that %s", (_, text) => {
    expect(() => parseLookups(JSON.parse(text))).toThrow(/^Lookups snapshot /);
  });
});
