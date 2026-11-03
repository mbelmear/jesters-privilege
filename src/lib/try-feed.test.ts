import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Fetch } from "./download";
import { tryFeed } from "./try-feed";

const URL = "https://www.spreaker.com/show/7523831/episodes/feed";
const fixture = readFileSync(
  join(process.cwd(), "src/content/feed-fixture.xml"),
  "utf8"
);

function serving(body: string): Fetch {
  return async (url) => {
    if (url !== URL) throw new Error(`Unexpected fetch of ${url}`);
    return { ok: true, status: 200, statusText: "OK", text: async () => body };
  };
}

function run(fetch: Fetch) {
  const log: string[] = [];
  return {
    log,
    code: tryFeed(URL, { fetch, log: (line) => log.push(line) }),
  };
}

describe("tryFeed", () => {
  it("lists the page each Episode would get, newest first", async () => {
    const { code, log } = run(serving(fixture));
    expect(await code).toBe(0);
    expect(log).toEqual([
      `The site can build from ${URL}: 6 Episodes`,
      "  /episodes/4  Is Humor a Virtue?",
      "  /episodes/bonus/listener-confessions-christmas-edition  Listener Confessions: Christmas Edition",
      "  /episodes/3  Mockery and the Prophets",
      "  /episodes/2  The Holy Fool",
      "  /episodes/1  Celebrity Pastors",
      "  /episodes/bonus/introducing-jesters-privilege-trailer  Introducing Jester's Privilege - Trailer",
    ]);
  });

  it("says what to fix in Spreaker when a full Episode has no number", async () => {
    // As Spreaker publishes an Episode whose number was never set.
    const unnumbered = fixture.replace(
      "<itunes:episode>1</itunes:episode>",
      ""
    );
    const { code, log } = run(serving(unnumbered));
    expect(await code).toBe(1);
    expect(log).toEqual([
      `The site can't build from ${URL}: Feed Episode "Celebrity Pastors" is a full Episode with no number; set its Episode number in Spreaker, or make it a bonus or trailer`,
    ]);
  });
});
