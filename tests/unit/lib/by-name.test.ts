import { byName } from "@/lib/by-name";

describe("byName", () => {
  it("sorts links alphabetically by the name a visitor reads", () => {
    const links = [
      { name: "YouTube" },
      { name: "Spotify" },
      { name: "RSS" },
      { name: "Apple Podcasts" },
      { name: "Amazon Music" },
    ];
    expect([...links].sort(byName).map(({ name }) => name)).toEqual([
      "Amazon Music",
      "Apple Podcasts",
      "RSS",
      "Spotify",
      "YouTube",
    ]);
  });
});
