import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFeed } from "./feed";

const fixture = readFileSync(
  join(process.cwd(), "src/content/feed-fixture.xml"),
  "utf8"
);

// Builds an item shaped like the fixture's. A field set to null is left out.
type ItemFields = {
  title: string | null;
  guid: string | null;
  pubDate: string | null;
  audioUrl: string | null;
  duration: string | null;
  description: string | null;
  episode: string | null;
  episodeType: string | null;
  image: string | null;
};

function item(fields: Partial<ItemFields> = {}): string {
  const f: ItemFields = {
    title: "An Episode",
    guid: "https://api.spreaker.com/episode/1",
    pubDate: "Thu, 12 Nov 2026 12:00:00 +0000",
    audioUrl: "https://dts.podtrac.com/redirect.mp3/example.mp3",
    duration: "1800",
    description: "<![CDATA[Show notes.]]>",
    episode: "1",
    episodeType: "full",
    image: "https://example.com/episode.jpg",
    ...fields,
  };
  const tag = (name: string, value: string | null) =>
    value === null ? "" : `<${name}>${value}</${name}>`;
  return [
    "<item>",
    tag("title", f.title),
    tag("description", f.description),
    tag("guid", f.guid),
    tag("pubDate", f.pubDate),
    f.audioUrl === null
      ? ""
      : `<enclosure url="${f.audioUrl}" length="1" type="audio/mpeg"/>`,
    tag("itunes:duration", f.duration),
    f.image === null ? "" : `<itunes:image href="${f.image}"/>`,
    tag("itunes:episode", f.episode),
    tag("itunes:episodeType", f.episodeType),
    "</item>",
  ].join("");
}

function feed(...items: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0" version="2.0"><channel><title>Jester's Privilege</title><itunes:image href="https://example.com/show.jpg"/>${items.join("")}</channel></rss>`;
}

describe("parseFeed", () => {
  it("reads every field of a full Episode", () => {
    const episode = parseFeed(fixture).find(
      (e) => e.type === "full" && e.number === 1
    );
    const { showNotesHtml, excerpt, ...rest } = episode ?? {};
    expect(showNotesHtml).toContain(
      "Every court needs a Fool, and every age has its celebrity pastors."
    );
    expect(excerpt).toMatch(/^Every court needs a Fool/);
    expect(rest).toEqual({
      type: "full",
      number: 1,
      guid: "https://api.spreaker.com/episode/70000002",
      title: "Celebrity Pastors",
      publishedAt: new Date("2026-11-12T12:00:00Z"),
      durationSeconds: 2752,
      audioUrl:
        "https://dts.podtrac.com/redirect.mp3/api.spreaker.com/download/episode/70000002/jesters_privilege_1.mp3",
      artworkUrl: "https://jestersprivilegepodcast.com/brand/logo-draft.png",
      transcriptUrl:
        "https://transcription.spreaker.com/starship/6a1f0c4e-0001-4c4d-9e10-000000000001/6a1f0c4e-0001-4c4d-9e10-000000000001.vtt",
    });
  });

  it("keeps bonus and trailer Episodes out of the numbering, addressed by slug", () => {
    const unnumbered = parseFeed(fixture).filter((e) => e.type !== "full");
    expect(unnumbered).toEqual([
      expect.objectContaining({
        type: "bonus",
        slug: "listener-confessions-christmas-edition",
        title: "Listener Confessions: Christmas Edition",
        transcriptUrl: null,
      }),
      expect.objectContaining({
        type: "trailer",
        slug: "introducing-jesters-privilege-trailer",
      }),
    ]);
    unnumbered.forEach((e) => expect(e).not.toHaveProperty("number"));
  });

  it("lists Episodes newest first, whatever order the feed uses", () => {
    const episodes = parseFeed(
      feed(
        item({
          episode: "1",
          guid: "a",
          pubDate: "Thu, 12 Nov 2026 12:00:00 +0000",
        }),
        item({
          episode: "3",
          guid: "c",
          pubDate: "Thu, 07 Jan 2027 12:00:00 +0000",
        }),
        item({
          episode: "2",
          guid: "b",
          pubDate: "Thu, 19 Nov 2026 12:00:00 +0000",
        })
      )
    );
    expect(episodes.map((e) => e.guid)).toEqual(["c", "b", "a"]);
  });

  it("fails when two full Episodes share a number, naming both", () => {
    expect(() =>
      parseFeed(
        feed(
          item({ title: "Celebrity Pastors", episode: "1", guid: "a" }),
          item({ title: "The Holy Fool", episode: "1", guid: "b" })
        )
      )
    ).toThrow(
      'Feed has two full Episodes numbered 1: "Celebrity Pastors" and "The Holy Fool"'
    );
  });

  it("fails when a full Episode lacks a number", () => {
    expect(() =>
      parseFeed(feed(item({ title: "Celebrity Pastors", episode: null })))
    ).toThrow(
      'Feed Episode "Celebrity Pastors" is a full Episode with no number'
    );
    expect(() =>
      parseFeed(feed(item({ title: "Celebrity Pastors", episode: "one" })))
    ).toThrow(
      'Feed Episode "Celebrity Pastors" has an Episode number that isn\'t a whole number: "one"'
    );
  });

  it("treats an Episode with no type as full, as Apple Podcasts does", () => {
    expect(parseFeed(feed(item({ episodeType: null, episode: "7" })))).toEqual([
      expect.objectContaining({ type: "full", number: 7 }),
    ]);
  });

  it.each([
    ["guid", { guid: null }],
    ["publish date", { pubDate: null }],
    ["audio URL", { audioUrl: null }],
    ["duration", { duration: null }],
    ["Show notes", { description: null }],
  ])("fails when an Episode is missing its %s", (field, fields) => {
    expect(() =>
      parseFeed(feed(item({ title: "Celebrity Pastors", ...fields })))
    ).toThrow(`Feed Episode "Celebrity Pastors" is missing its ${field}`);
  });

  it("names an Episode with no title by its guid", () => {
    expect(() =>
      parseFeed(
        feed(item({ title: null, guid: "https://api.spreaker.com/episode/9" }))
      )
    ).toThrow(
      'Feed Episode with guid "https://api.spreaker.com/episode/9" is missing its title'
    );
  });

  it("fails on a publish date or duration it can't read", () => {
    expect(() =>
      parseFeed(
        feed(item({ title: "Celebrity Pastors", pubDate: "next Thursday" }))
      )
    ).toThrow(
      'Feed Episode "Celebrity Pastors" has a publish date that isn\'t a date: "next Thursday"'
    );
    expect(() =>
      parseFeed(feed(item({ title: "Celebrity Pastors", duration: "long" })))
    ).toThrow(
      'Feed Episode "Celebrity Pastors" has a duration that isn\'t a length of time: "long"'
    );
  });

  it("reads durations written as hours, minutes, and seconds", () => {
    const durations = ["1:02:03", "45:30", "2752"].map(
      (duration) => parseFeed(feed(item({ duration })))[0].durationSeconds
    );
    expect(durations).toEqual([3723, 2730, 2752]);
  });

  it("uses the show's artwork for an Episode without its own, as podcast apps do", () => {
    expect(parseFeed(feed(item({ image: null })))[0].artworkUrl).toBe(
      "https://example.com/show.jpg"
    );
    const noShowArtwork = feed(
      item({ title: "Celebrity Pastors", image: null })
    ).replace('<itunes:image href="https://example.com/show.jpg"/>', "");
    expect(() => parseFeed(noShowArtwork)).toThrow(
      'Feed Episode "Celebrity Pastors" is missing its artwork'
    );
  });

  it("returns no Episodes for a feed with none, before Episode 1 is published", () => {
    expect(parseFeed(feed())).toEqual([]);
  });

  it("fails on something that isn't a feed, such as an HTML error page", () => {
    expect(() =>
      parseFeed("<!doctype html><html><body>Bad gateway</body></html>")
    ).toThrow("Feed has no <channel>; is this an RSS feed?");
  });

  it("sanitizes Show notes to paragraphs, line breaks, links, emphasis, and lists", () => {
    const description = [
      '<p style="color:red">Hello <strong>there</strong><script>alert(1)</script></p>',
      "<h2>Heading</h2><br />",
      '<img src="x" onerror="alert(1)"><em>a</em> <b>b</b> <i>c</i>',
      "<ol><li>one</li></ol><ul><li>two</li></ul>",
    ].join("");
    const [episode] = parseFeed(
      feed(item({ description: `<![CDATA[${description}]]>` }))
    );
    expect(episode.showNotesHtml).toBe(
      "<p>Hello <strong>there</strong></p>Heading<br />" +
        "<em>a</em> <b>b</b> <i>c</i><ol><li>one</li></ol><ul><li>two</li></ul>"
    );
  });

  it("makes Show notes links open safely in a new tab, and drops unsafe ones", () => {
    const description = [
      '<a href="https://www.instagram.com/jestersprivilege/" target="_self" onclick="x()">Instagram</a>',
      '<a href="mailto:hello@jestersprivilegepodcast.com">Email</a>',
      '<a href="javascript:alert(1)">Bad</a>',
    ].join(" ");
    const [episode] = parseFeed(
      feed(item({ description: `<![CDATA[${description}]]>` }))
    );
    expect(episode.showNotesHtml).toBe(
      '<a href="https://www.instagram.com/jestersprivilege/" target="_blank" rel="noopener noreferrer">Instagram</a> ' +
        '<a href="mailto:hello@jestersprivilegepodcast.com" target="_blank" rel="noopener noreferrer">Email</a> ' +
        "<a>Bad</a>"
    );
  });

  it("gives each Episode a plain-text excerpt of its Show notes", () => {
    const [episode] = parseFeed(
      feed(
        item({
          description:
            '<![CDATA[<p>Faith &amp; folly.</p><p>With <em>three</em> Jesters.<br /><br /><a href="https://example.com">Follow us.</a></p>]]>',
        })
      )
    );
    expect(episode.excerpt).toBe(
      "Faith & folly. With three Jesters. Follow us."
    );
  });

  it("cuts a long excerpt at a word boundary, under 200 characters", () => {
    const sentence = "Every court needs a Fool to tell the king the truth. ";
    const [episode] = parseFeed(
      feed(item({ description: sentence.repeat(10) }))
    );
    expect(episode.excerpt.length).toBeLessThanOrEqual(200);
    expect(episode.excerpt).toMatch(/\S…$/);
    const kept = episode.excerpt.slice(0, -1);
    expect(sentence.repeat(10).startsWith(`${kept} `)).toBe(true);
  });

  it("fails on an Episode type podcast apps don't know", () => {
    expect(() =>
      parseFeed(
        feed(item({ title: "Celebrity Pastors", episodeType: "special" }))
      )
    ).toThrow(
      'Feed Episode "Celebrity Pastors" has type "special"; expected full, bonus, or trailer'
    );
  });

  it("fails when two unnumbered Episodes would share an address", () => {
    expect(() =>
      parseFeed(
        feed(
          item({
            title: "Listener Confessions!",
            episodeType: "bonus",
            guid: "a",
          }),
          item({
            title: "Listener confessions",
            episodeType: "trailer",
            guid: "b",
          })
        )
      )
    ).toThrow(
      'Feed has two Episodes at /episodes/bonus/listener-confessions: "Listener Confessions!" and "Listener confessions"'
    );
  });

  it("fails when an unnumbered Episode's title gives it no address", () => {
    expect(() =>
      parseFeed(feed(item({ title: "🃏 !!", episodeType: "bonus" })))
    ).toThrow(
      'Feed Episode "🃏 !!" has no letters or digits in its title to make its address from'
    );
  });
});
