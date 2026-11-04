import type { Fetch } from "./download";
import type { ListedEpisodes } from "./episode-listen-links";
import { checkFeed, runFeedCheck, type FeedCheckEnv } from "./feed-check";

const SITE = "https://jestersprivilegepodcast.com";
const EPISODE_1 = "https://www.spreaker.com/episode/61234567";
const EPISODE_2 = "https://www.spreaker.com/episode/61299999";

// A live site whose build manifest answers with `body`.
function liveSite(body: string, status = 200): Fetch {
  return async (url) => {
    if (url !== `${SITE}/build-manifest.json`) {
      throw new Error(`Unexpected fetch of ${url}`);
    }
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : "Not Found",
      text: async () => body,
    };
  };
}

function deployedWith(
  newestEpisodeGuid: string | null,
  episodeListenLinks: ListedEpisodes = {},
  transcripts: string[] = []
): Fetch {
  return liveSite(
    JSON.stringify({
      newestEpisodeGuid,
      commit: "7c625bc",
      episodeListenLinks,
      transcripts,
    })
  );
}

// The feed, the apps' lookups, and the Transcripts as they stand: no Episode
// Listen links or Transcripts unless a test gives some.
const feed = (
  newestEpisodeGuid: string | null,
  episodeListenLinks: ListedEpisodes = {},
  transcripts: string[] = []
) => ({
  newestEpisodeGuid: async () => newestEpisodeGuid,
  episodeListenLinks: async () => episodeListenLinks,
  transcripts: async () => transcripts,
});

describe("checkFeed", () => {
  it("leaves the site alone when its newest Episode is the feed's", async () => {
    const result = await checkFeed(SITE, {
      fetch: deployedWith(EPISODE_1),
      ...feed(EPISODE_1),
    });
    expect(result).toEqual({
      rebuild: false,
      reason: `The live site already has the newest Episode (${EPISODE_1}) and every Episode Listen link and Transcript`,
    });
  });

  it("rebuilds when an Episode has gained an Episode Listen link since the deploy", async () => {
    const result = await checkFeed(SITE, {
      fetch: deployedWith(EPISODE_2, { "apple-podcasts": [EPISODE_1] }),
      ...feed(EPISODE_2, { "apple-podcasts": [EPISODE_2, EPISODE_1] }),
    });
    expect(result).toEqual({
      rebuild: true,
      reason: `Episodes have gained Episode Listen links since the live site was built: ${EPISODE_2} in Apple Podcasts`,
    });
  });

  it("leaves the site alone when an Episode has lost a link, as when a lookup failed", async () => {
    const result = await checkFeed(SITE, {
      fetch: deployedWith(EPISODE_2, {
        "apple-podcasts": [EPISODE_2, EPISODE_1],
      }),
      ...feed(EPISODE_2),
    });
    expect(result.rebuild).toBe(false);
  });

  it("rebuilds when an Episode has gained a Transcript since the deploy", async () => {
    const result = await checkFeed(SITE, {
      fetch: deployedWith(EPISODE_2, {}, [EPISODE_1]),
      ...feed(EPISODE_2, {}, [EPISODE_2, EPISODE_1]),
    });
    expect(result).toEqual({
      rebuild: true,
      reason: `Episodes have gained Transcripts since the live site was built: ${EPISODE_2}`,
    });
  });

  it("leaves the site alone when an Episode has lost its Transcript, as when a download failed", async () => {
    const result = await checkFeed(SITE, {
      fetch: deployedWith(EPISODE_2, {}, [EPISODE_2, EPISODE_1]),
      ...feed(EPISODE_2, {}, [EPISODE_1]),
    });
    expect(result.rebuild).toBe(false);
  });

  it("rebuilds when the feed has a newer Episode than the live site", async () => {
    const result = await checkFeed(SITE, {
      fetch: deployedWith(EPISODE_1),
      ...feed(EPISODE_2),
    });
    expect(result).toEqual({
      rebuild: true,
      reason: `The feed's newest Episode (${EPISODE_2}) isn't on the live site, which has ${EPISODE_1}`,
    });
  });

  it.each<[string, Fetch, string]>([
    [
      "isn't there",
      liveSite("<!doctype html><h1>Not found</h1>", 404),
      `Build manifest ${SITE}/build-manifest.json answered 404 Not Found`,
    ],
    [
      "isn't JSON",
      liveSite("<!doctype html><h1>Hello</h1>"),
      `Build manifest ${SITE}/build-manifest.json isn't JSON`,
    ],
    [
      "isn't a manifest",
      liveSite(JSON.stringify({ commit: "7c625bc" })),
      "Build manifest is missing newestEpisodeGuid",
    ],
    [
      "can't be reached",
      async () => {
        throw new Error("getaddrinfo ENOTFOUND");
      },
      `Build manifest ${SITE}/build-manifest.json couldn't be reached: getaddrinfo ENOTFOUND`,
    ],
  ])(
    "fails, naming why, when the live site's manifest %s",
    async (_, fetch, problem) => {
      await expect(
        checkFeed(SITE, { fetch, ...feed(EPISODE_1) })
      ).rejects.toThrow(problem);
    }
  );
});

describe("runFeedCheck", () => {
  // The workflow's side of a run: its step outputs and its log.
  function workflow(io: Omit<FeedCheckEnv, "setOutput" | "log">) {
    const outputs: string[] = [];
    const log: string[] = [];
    const env: FeedCheckEnv = {
      ...io,
      setOutput: (name, value) => outputs.push(`${name}=${value}`),
      log: (line) => log.push(line),
    };
    return { env, outputs, log };
  }

  it("tells the workflow not to deploy when nothing changed", async () => {
    const { env, outputs, log } = workflow({
      fetch: deployedWith(EPISODE_1),
      ...feed(EPISODE_1),
    });
    expect(await runFeedCheck(SITE, env)).toBe(0);
    expect(outputs).toEqual(["rebuild=false"]);
    expect(log).toEqual([
      `::notice::No rebuild: The live site already has the newest Episode (${EPISODE_1}) and every Episode Listen link and Transcript`,
    ]);
  });

  it("tells the workflow to deploy when the feed has a new Episode", async () => {
    const { env, outputs, log } = workflow({
      fetch: deployedWith(EPISODE_1),
      ...feed(EPISODE_2),
    });
    expect(await runFeedCheck(SITE, env)).toBe(0);
    expect(outputs).toEqual(["rebuild=true"]);
    expect(log).toEqual([
      `::notice::Rebuilding: The feed's newest Episode (${EPISODE_2}) isn't on the live site, which has ${EPISODE_1}`,
    ]);
  });

  it("fails the run, deploying nothing, when the feed can't be read", async () => {
    const { env, outputs, log } = workflow({
      fetch: deployedWith(EPISODE_1),
      ...feed(EPISODE_1),
      newestEpisodeGuid: async () => {
        throw new Error(
          "Feed https://www.spreaker.com/show/6900001/episodes/feed answered 503 Service Unavailable"
        );
      },
    });
    expect(await runFeedCheck(SITE, env)).toBe(1);
    expect(outputs).toEqual([]);
    expect(log).toEqual([
      "::error::Feed check failed, so the live site stays as it is: Feed https://www.spreaker.com/show/6900001/episodes/feed answered 503 Service Unavailable",
    ]);
  });

  it("fails the run, deploying nothing, when the live manifest can't be read", async () => {
    const { env, outputs, log } = workflow({
      fetch: liveSite("<!doctype html><h1>Not found</h1>", 404),
      ...feed(EPISODE_1),
    });
    expect(await runFeedCheck(SITE, env)).toBe(1);
    expect(outputs).toEqual([]);
    expect(log).toEqual([
      `::error::Feed check failed, so the live site stays as it is: Build manifest ${SITE}/build-manifest.json answered 404 Not Found`,
    ]);
  });
});
