import { getEpisodes, getTranscript } from "./feed";

// A warning (an unreadable Transcript) fails the test, via jest.setup.ts.
describe("the fixture's Transcripts", () => {
  it("gives every fixture Episode with a Transcript link a readable Transcript", async () => {
    const episodes = await getEpisodes();
    const linked = episodes.filter((episode) => episode.transcriptUrl);
    expect(linked.length).toBeGreaterThan(0);
    for (const episode of linked) {
      const transcript = await getTranscript(episode);
      expect(transcript?.length).toBeGreaterThan(1);
    }
  });

  it("leaves an Episode without a Transcript link without one", async () => {
    const episodes = await getEpisodes();
    const unlinked = episodes.find((episode) => !episode.transcriptUrl);
    expect(unlinked).toBeDefined();
    expect(unlinked && (await getTranscript(unlinked))).toBeNull();
  });
});
