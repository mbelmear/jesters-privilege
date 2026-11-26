import { compareRecords, parseBuildManifest } from "@/lib/build-manifest";
import { EPISODE_1, EPISODE_2, record } from "../../build-records";

describe("parseBuildManifest", () => {
  it("reads the newest Episode, commit, and Transcripts a deploy was built with", () => {
    expect(
      parseBuildManifest({
        newestEpisodeGuid: "https://www.spreaker.com/episode/61234567",
        commit: "7c625bc",
        episodeListenLinks: {
          "apple-podcasts": ["https://www.spreaker.com/episode/61234567"],
        },
        transcripts: ["https://www.spreaker.com/episode/61234567"],
      })
    ).toEqual({
      newestEpisodeGuid: "https://www.spreaker.com/episode/61234567",
      commit: "7c625bc",
      episodeListenLinks: {
        "apple-podcasts": ["https://www.spreaker.com/episode/61234567"],
      },
      transcripts: ["https://www.spreaker.com/episode/61234567"],
    });
  });

  it("accepts a deploy built before the first Episode, outside CI", () => {
    expect(
      parseBuildManifest({
        newestEpisodeGuid: null,
        commit: null,
        episodeListenLinks: {},
        transcripts: [],
      })
    ).toEqual({
      newestEpisodeGuid: null,
      commit: null,
      episodeListenLinks: {},
      transcripts: [],
    });
  });

  it("rejects something that isn't a manifest, such as an HTML error page", () => {
    expect(() => parseBuildManifest("<!doctype html>")).toThrow(
      "Build manifest must be an object"
    );
  });

  it("names the field that is missing", () => {
    const links = { episodeListenLinks: {}, transcripts: [] };
    expect(() => parseBuildManifest({ commit: "7c625bc", ...links })).toThrow(
      "Build manifest is missing newestEpisodeGuid"
    );
    expect(() =>
      parseBuildManifest({ newestEpisodeGuid: null, ...links })
    ).toThrow("Build manifest is missing commit");
    expect(() =>
      parseBuildManifest({
        newestEpisodeGuid: null,
        commit: null,
        transcripts: [],
      })
    ).toThrow("Build manifest is missing episodeListenLinks");
    expect(() =>
      parseBuildManifest({
        newestEpisodeGuid: null,
        commit: null,
        episodeListenLinks: {},
      })
    ).toThrow("Build manifest is missing transcripts");
  });

  it("names the field with the wrong type", () => {
    const valid = {
      newestEpisodeGuid: null,
      commit: null,
      episodeListenLinks: {},
      transcripts: [],
    };
    expect(() =>
      parseBuildManifest({ ...valid, newestEpisodeGuid: 61234567 })
    ).toThrow("Build manifest newestEpisodeGuid must be a string or null");
    expect(() => parseBuildManifest({ ...valid, commit: false })).toThrow(
      "Build manifest commit must be a string or null"
    );
    expect(() =>
      parseBuildManifest({ ...valid, episodeListenLinks: [] })
    ).toThrow(
      "Build manifest episodeListenLinks must map apps to lists of Episode GUIDs"
    );
    expect(() =>
      parseBuildManifest({
        ...valid,
        episodeListenLinks: { "apple-podcasts": [76161078] },
      })
    ).toThrow(
      "Build manifest episodeListenLinks must map apps to lists of Episode GUIDs"
    );
    expect(() => parseBuildManifest({ ...valid, transcripts: {} })).toThrow(
      "Build manifest transcripts must be a list of Episode GUIDs"
    );
    expect(() =>
      parseBuildManifest({ ...valid, transcripts: [76161078] })
    ).toThrow("Build manifest transcripts must be a list of Episode GUIDs");
  });

  it("names an app it doesn't know", () => {
    expect(() =>
      parseBuildManifest({
        newestEpisodeGuid: null,
        commit: null,
        episodeListenLinks: { rss: [] },
        transcripts: [],
      })
    ).toThrow(
      'Build manifest episodeListenLinks has "rss", which isn\'t an app with Episode Listen links'
    );
  });
});

describe("compareRecords", () => {
  it("leaves the site alone when its newest Episode is the feed's", () => {
    expect(compareRecords(record(EPISODE_1), record(EPISODE_1))).toEqual({
      rebuild: false,
      reason: `The live site already has the newest Episode (${EPISODE_1}) and every Episode Listen link and Transcript`,
    });
  });

  it("rebuilds when the feed has a newer Episode than the live site", () => {
    expect(compareRecords(record(EPISODE_1), record(EPISODE_2))).toEqual({
      rebuild: true,
      newEpisode: true,
      reason: `The feed's newest Episode (${EPISODE_2}) isn't on the live site, which has ${EPISODE_1}`,
    });
  });

  it("rebuilds when an Episode has gained an Episode Listen link since the deploy", () => {
    const live = record(EPISODE_2, {
      episodeListenLinks: { "apple-podcasts": [EPISODE_1] },
    });
    const fresh = record(EPISODE_2, {
      episodeListenLinks: { "apple-podcasts": [EPISODE_2, EPISODE_1] },
    });
    expect(compareRecords(live, fresh)).toEqual({
      rebuild: true,
      newEpisode: false,
      reason: `Episodes have gained Episode Listen links since the live site was built: ${EPISODE_2} in Apple Podcasts`,
    });
  });

  it("leaves the site alone when an Episode has lost a link, as when a lookup failed", () => {
    const live = record(EPISODE_2, {
      episodeListenLinks: { "apple-podcasts": [EPISODE_2, EPISODE_1] },
    });
    expect(compareRecords(live, record(EPISODE_2)).rebuild).toBe(false);
  });

  it("rebuilds when an Episode has gained a Transcript since the deploy", () => {
    const live = record(EPISODE_2, { transcripts: [EPISODE_1] });
    const fresh = record(EPISODE_2, { transcripts: [EPISODE_2, EPISODE_1] });
    expect(compareRecords(live, fresh)).toEqual({
      rebuild: true,
      newEpisode: false,
      reason: `Episodes have gained Transcripts since the live site was built: ${EPISODE_2}`,
    });
  });

  it("leaves the site alone when an Episode has lost its Transcript, as when a download failed", () => {
    const live = record(EPISODE_2, { transcripts: [EPISODE_2, EPISODE_1] });
    const fresh = record(EPISODE_2, { transcripts: [EPISODE_1] });
    expect(compareRecords(live, fresh).rebuild).toBe(false);
  });
});
