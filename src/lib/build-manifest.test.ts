import { parseBuildManifest } from "./build-manifest";

describe("parseBuildManifest", () => {
  it("reads the newest Episode and commit a deploy was built with", () => {
    expect(
      parseBuildManifest({
        newestEpisodeGuid: "https://www.spreaker.com/episode/61234567",
        commit: "7c625bc",
        episodeListenLinks: {
          "apple-podcasts": ["https://www.spreaker.com/episode/61234567"],
        },
      })
    ).toEqual({
      newestEpisodeGuid: "https://www.spreaker.com/episode/61234567",
      commit: "7c625bc",
      episodeListenLinks: {
        "apple-podcasts": ["https://www.spreaker.com/episode/61234567"],
      },
    });
  });

  it("accepts a deploy built before the first Episode, outside CI", () => {
    expect(
      parseBuildManifest({
        newestEpisodeGuid: null,
        commit: null,
        episodeListenLinks: {},
      })
    ).toEqual({
      newestEpisodeGuid: null,
      commit: null,
      episodeListenLinks: {},
    });
  });

  it("rejects something that isn't a manifest, such as an HTML error page", () => {
    expect(() => parseBuildManifest("<!doctype html>")).toThrow(
      "Build manifest must be an object"
    );
  });

  it("names the field that is missing", () => {
    const links = { episodeListenLinks: {} };
    expect(() => parseBuildManifest({ commit: "7c625bc", ...links })).toThrow(
      "Build manifest is missing newestEpisodeGuid"
    );
    expect(() =>
      parseBuildManifest({ newestEpisodeGuid: null, ...links })
    ).toThrow("Build manifest is missing commit");
    expect(() =>
      parseBuildManifest({ newestEpisodeGuid: null, commit: null })
    ).toThrow("Build manifest is missing episodeListenLinks");
  });

  it("names the field with the wrong type", () => {
    const valid = {
      newestEpisodeGuid: null,
      commit: null,
      episodeListenLinks: {},
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
  });

  it("names an app it doesn't know", () => {
    expect(() =>
      parseBuildManifest({
        newestEpisodeGuid: null,
        commit: null,
        episodeListenLinks: { rss: [] },
      })
    ).toThrow(
      'Build manifest episodeListenLinks has "rss", which isn\'t an app with Episode Listen links'
    );
  });
});
