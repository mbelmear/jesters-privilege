import type { BuildRecord } from "@/lib/build-manifest";
import type { Fetch } from "@/lib/download";
import { runFeedCheck, type FeedCheckEnv } from "@/lib/feed-check";
import { EPISODE_1, EPISODE_2, record } from "../../build-records";

const SITE = "https://jestersprivilegepodcast.com";

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

const deployedWith = (live: BuildRecord): Fetch =>
  liveSite(JSON.stringify({ ...live, commit: "7c625bc" }));

// The workflow's side of a run, its step outputs and its log, against a live
// site and the record a fresh build would make now.
function workflow(fetch: Fetch, fresh: () => Promise<BuildRecord>) {
  const outputs: string[] = [];
  const log: string[] = [];
  const freshRecord = jest.fn(fresh);
  const env: FeedCheckEnv = {
    fetch,
    freshRecord,
    setOutput: (name, value) => outputs.push(`${name}=${value}`),
    log: (line) => log.push(line),
  };
  return { env, outputs, log, freshRecord };
}

describe("runFeedCheck", () => {
  it("tells the workflow not to deploy when nothing changed", async () => {
    const { env, outputs, log } = workflow(
      deployedWith(record(EPISODE_1)),
      async () => record(EPISODE_1)
    );
    expect(await runFeedCheck(SITE, env)).toBe(0);
    expect(outputs).toEqual(["rebuild=false"]);
    expect(log).toEqual([
      `::notice::No rebuild: The live site already has the newest Episode (${EPISODE_1}) and every Episode Listen link and Transcript`,
    ]);
  });

  it("tells the workflow to deploy when the feed has a new Episode", async () => {
    const { env, outputs, log } = workflow(
      deployedWith(record(EPISODE_1)),
      async () => record(EPISODE_2)
    );
    expect(await runFeedCheck(SITE, env)).toBe(0);
    expect(outputs).toEqual(["rebuild=true"]);
    expect(log).toEqual([
      `::notice::Rebuilding: The feed's newest Episode (${EPISODE_2}) isn't on the live site, which has ${EPISODE_1}`,
    ]);
  });

  it("tells the workflow to deploy when an Episode has gained a Listen link", async () => {
    const { env, outputs, log } = workflow(
      deployedWith(record(EPISODE_1)),
      async () =>
        record(EPISODE_1, { episodeListenLinks: { spotify: [EPISODE_1] } })
    );
    expect(await runFeedCheck(SITE, env)).toBe(0);
    expect(outputs).toEqual(["rebuild=true"]);
    expect(log).toEqual([
      `::notice::Rebuilding: Episodes have gained Episode Listen links since the live site was built: ${EPISODE_1} in Spotify`,
    ]);
  });

  it("tells the workflow not to deploy when a failed lookup lists none of an app's Episodes", async () => {
    const { env, outputs, log } = workflow(
      deployedWith(
        record(EPISODE_1, { episodeListenLinks: { spotify: [EPISODE_1] } })
      ),
      async () => record(EPISODE_1)
    );
    expect(await runFeedCheck(SITE, env)).toBe(0);
    expect(outputs).toEqual(["rebuild=false"]);
    expect(log).toEqual([
      `::notice::No rebuild: The live site already has the newest Episode (${EPISODE_1}) and every Episode Listen link and Transcript`,
    ]);
  });

  it("tells the workflow to deploy when an Episode has gained a Transcript", async () => {
    const { env, outputs, log } = workflow(
      deployedWith(record(EPISODE_1)),
      async () => record(EPISODE_1, { transcripts: [EPISODE_1] })
    );
    expect(await runFeedCheck(SITE, env)).toBe(0);
    expect(outputs).toEqual(["rebuild=true"]);
    expect(log).toEqual([
      `::notice::Rebuilding: Episodes have gained Transcripts since the live site was built: ${EPISODE_1}`,
    ]);
  });

  it("builds the fresh record once per run", async () => {
    const { env, freshRecord } = workflow(
      deployedWith(record(EPISODE_1)),
      async () => record(EPISODE_1)
    );
    await runFeedCheck(SITE, env);
    expect(freshRecord).toHaveBeenCalledTimes(1);
  });

  it("fails the run, deploying nothing, when the feed can't be read", async () => {
    const { env, outputs, log } = workflow(
      deployedWith(record(EPISODE_1)),
      async () => {
        throw new Error(
          "Feed https://www.spreaker.com/show/6900001/episodes/feed answered 503 Service Unavailable"
        );
      }
    );
    expect(await runFeedCheck(SITE, env)).toBe(1);
    expect(outputs).toEqual([]);
    expect(log).toEqual([
      "::error::Feed check failed, so the live site stays as it is: Feed https://www.spreaker.com/show/6900001/episodes/feed answered 503 Service Unavailable",
    ]);
  });

  it("names the feed, not the manifest, when neither can be read", async () => {
    const { env, log } = workflow(
      liveSite("<!doctype html><h1>Not found</h1>", 404),
      async () => {
        throw new Error("Feed answered 503 Service Unavailable");
      }
    );
    expect(await runFeedCheck(SITE, env)).toBe(1);
    expect(log).toEqual([
      "::error::Feed check failed, so the live site stays as it is: Feed answered 503 Service Unavailable",
    ]);
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
    "fails the run, deploying nothing, naming why, when the live manifest %s",
    async (_, fetch, problem) => {
      const { env, outputs, log } = workflow(fetch, async () =>
        record(EPISODE_1)
      );
      expect(await runFeedCheck(SITE, env)).toBe(1);
      expect(outputs).toEqual([]);
      expect(log).toEqual([
        `::error::Feed check failed, so the live site stays as it is: ${problem}`,
      ]);
    }
  );
});
