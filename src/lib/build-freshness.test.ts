import { buildFreshness } from "./build-freshness";

describe("buildFreshness", () => {
  const sources = [
    { path: "src/app/page.tsx", modifiedMs: 1_000 },
    { path: "src/content/site.ts", modifiedMs: 3_000 },
  ];

  it("finds no build when out/ has no home page", () => {
    expect(buildFreshness(null, sources)).toEqual({ kind: "missing" });
  });

  it("finds the build stale when a source changed after it, naming the newest", () => {
    expect(buildFreshness(2_000, sources)).toEqual({
      kind: "stale",
      newest: "src/content/site.ts",
    });
  });

  it("finds the build fresh when it is newer than every source", () => {
    expect(buildFreshness(3_000, sources)).toEqual({ kind: "fresh" });
  });

  // A test changes nothing a visitor sees, so editing one after the build
  // needs no rebuild.
  it("ignores tests changed after the build", () => {
    expect(
      buildFreshness(3_000, [
        ...sources,
        { path: "src/app/page.test.tsx", modifiedMs: 9_000 },
      ])
    ).toEqual({ kind: "fresh" });
  });
});
