import { parseBuildManifest } from "./build-manifest";

describe("parseBuildManifest", () => {
  it("reads the newest Episode and commit a deploy was built with", () => {
    expect(
      parseBuildManifest({
        newestEpisode: "https://www.spreaker.com/episode/61234567",
        commit: "7c625bc",
      })
    ).toEqual({
      newestEpisode: "https://www.spreaker.com/episode/61234567",
      commit: "7c625bc",
    });
  });

  it("accepts a deploy built before the first Episode, outside CI", () => {
    expect(parseBuildManifest({ newestEpisode: null, commit: null })).toEqual({
      newestEpisode: null,
      commit: null,
    });
  });

  it("rejects something that isn't a manifest, such as an HTML error page", () => {
    expect(() => parseBuildManifest("<!doctype html>")).toThrow(
      "Build manifest must be an object"
    );
  });

  it("names the field that is missing", () => {
    expect(() => parseBuildManifest({ commit: "7c625bc" })).toThrow(
      "Build manifest is missing newestEpisode"
    );
    expect(() => parseBuildManifest({ newestEpisode: null })).toThrow(
      "Build manifest is missing commit"
    );
  });

  it("names the field with the wrong type", () => {
    expect(() =>
      parseBuildManifest({ newestEpisode: 61234567, commit: "7c625bc" })
    ).toThrow("Build manifest newestEpisode must be a string or null");
    expect(() =>
      parseBuildManifest({ newestEpisode: null, commit: false })
    ).toThrow("Build manifest commit must be a string or null");
  });
});
