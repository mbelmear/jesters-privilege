import { parseBuildManifest } from "./build-manifest";

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
