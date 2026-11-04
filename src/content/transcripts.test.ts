import { getEpisodes, getTranscribedEpisodes, getTranscript } from "./feed";

// A warning (an unreadable Transcript) fails the test, via jest.setup.ts,
// unless a test expects one.
describe("the fixture's Transcripts", () => {
  async function episode(title: string) {
    const found = (await getEpisodes()).find((e) => e.title === title);
    if (!found) throw new Error(`The fixture has no Episode "${title}"`);
    return found;
  }

  async function words(title: string): Promise<string | undefined> {
    return (await getTranscript(await episode(title)))
      ?.map(({ text }) => text)
      .join(" ");
  }

  beforeEach(() => {
    // The bonus Episode has no Transcript, which the build log notes.
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("gives every fixture Episode with a Transcript link a readable Transcript", async () => {
    const linked = (await getEpisodes()).filter((e) => e.transcriptUrl);
    expect(linked.length).toBeGreaterThan(0);
    for (const e of linked) {
      expect((await getTranscript(e))?.length).toBeGreaterThan(1);
    }
  });

  it("reads the site's own Transcript of an Episode the feed links none for", async () => {
    const humor = await episode("Is Humor a Virtue?");
    expect(humor.transcriptUrl).toBeNull();
    expect(await words("Is Humor a Virtue?")).toContain("start with a pun");
  });

  it("prefers the Transcript the feed links to the site's own", async () => {
    expect(await words("Celebrity Pastors")).not.toContain(
      "This saved Transcript loses"
    );
    expect(await words("Celebrity Pastors")).toContain("So the reason");
  });

  it("leaves an Episode with neither without one, and says why", async () => {
    expect(
      await words("Listener Confessions: Christmas Edition")
    ).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      'Episode "Listener Confessions: Christmas Edition" has no Transcript yet: the feed links none, and the transcripts branch has no https%3A%2F%2Fapi.spreaker.com%2Fepisode%2F70000005.vtt'
    );
  });

  it("records every Episode with a Transcript for the build manifest", async () => {
    expect(await getTranscribedEpisodes()).toEqual([
      "https://api.spreaker.com/episode/70000006",
      "https://api.spreaker.com/episode/70000004",
      "https://api.spreaker.com/episode/70000003",
      "https://api.spreaker.com/episode/70000002",
      "https://api.spreaker.com/episode/70000001",
    ]);
  });
});
