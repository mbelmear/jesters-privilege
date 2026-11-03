import type { Episode } from "./feed";
import {
  cardAt,
  cardPaths,
  episodeCardPath,
  episodeJsonLd,
  pageMetadata,
  seriesJsonLd,
  serializeJsonLd,
  sitemapEntries,
} from "./seo";

const site = {
  name: "Jester's Privilege",
  tagline: "Theology in the Motley.",
  url: "https://jestersprivilegepodcast.com",
};

const details = {
  durationSeconds: 2592,
  showNotesHtml: "<p>Notes</p>",
  artworkUrl: "https://jestersprivilegepodcast.com/brand/logo.png",
  transcriptUrl: null,
};

const celebrityPastors: Episode = {
  ...details,
  type: "full",
  number: 1,
  guid: "ep-1",
  title: "Celebrity Pastors",
  publishedAt: new Date("2026-11-09T11:00:00Z"),
  audioUrl: "https://dts.podtrac.com/redirect.mp3/example.com/1.mp3",
  excerpt: "Why the church keeps crowning its preachers.",
};

const christmasConfessions: Episode = {
  ...details,
  type: "bonus",
  slug: "listener-confessions-christmas-edition",
  guid: "bonus-1",
  title: "Listener Confessions: Christmas Edition",
  publishedAt: new Date("2026-12-24T11:00:00Z"),
  audioUrl: "https://dts.podtrac.com/redirect.mp3/example.com/bonus.mp3",
  excerpt: "Your follies, read aloud.",
};

describe("pageMetadata", () => {
  it("gives a page its title, description, canonical address, and card text", () => {
    expect(
      pageMetadata(site, {
        path: "/about",
        title: "About",
        description: "Three Jesters who serve the King.",
      })
    ).toEqual({
      title: "About",
      description: "Three Jesters who serve the King.",
      alternates: { canonical: "/about" },
      openGraph: {
        type: "website",
        siteName: "Jester's Privilege",
        title: "About",
        description: "Three Jesters who serve the King.",
        url: "/about",
        images: [
          {
            url: "/cards/site.png",
            width: 1200,
            height: 630,
            alt: "Jester's Privilege: Theology in the Motley.",
          },
        ],
      },
    });
  });

  it("shows a page's own card when it has one", () => {
    const metadata = pageMetadata(site, {
      path: "/episodes/1",
      title: "Episode 1: Celebrity Pastors",
      description: "Why the church keeps crowning its preachers.",
      card: {
        path: "/cards/episodes/1.png",
        alt: "Episode 1: Celebrity Pastors",
      },
    });
    expect(metadata.openGraph?.images).toEqual([
      {
        url: "/cards/episodes/1.png",
        width: 1200,
        height: 630,
        alt: "Episode 1: Celebrity Pastors",
      },
    ]);
  });

  it("titles the home page with the show's name alone", () => {
    const metadata = pageMetadata(site, {
      path: "/",
      description: "A weekly theology-and-humor podcast.",
    });
    expect(metadata.title).toEqual({ absolute: "Jester's Privilege" });
    expect(metadata.openGraph?.title).toBe("Jester's Privilege");
    expect(metadata.alternates?.canonical).toBe("/");
  });

  it("refuses an address that isn't a clean path on the site", () => {
    for (const path of [
      "about",
      "/about/",
      "/about.html",
      "/gallery#stanczyk",
    ]) {
      expect(() =>
        pageMetadata(site, { path, title: "About", description: "Words." })
      ).toThrow(`"${path}"`);
    }
  });
});

describe("sitemapEntries", () => {
  it("lists each page and each Episode at its full address, Episodes dated by when they were published", () => {
    expect(
      sitemapEntries(
        site,
        ["/", "/gallery"],
        [christmasConfessions, celebrityPastors]
      )
    ).toEqual([
      { url: "https://jestersprivilegepodcast.com/" },
      { url: "https://jestersprivilegepodcast.com/gallery" },
      {
        url: "https://jestersprivilegepodcast.com/episodes/bonus/listener-confessions-christmas-edition",
        lastModified: new Date("2026-12-24T11:00:00Z"),
      },
      {
        url: "https://jestersprivilegepodcast.com/episodes/1",
        lastModified: new Date("2026-11-09T11:00:00Z"),
      },
    ]);
  });

  it("refuses a page address that isn't a clean path", () => {
    expect(() => sitemapEntries(site, ["/styleguide.html"], [])).toThrow(
      '"/styleguide.html"'
    );
  });
});

const series = {
  site,
  description: "A weekly theology-and-humor podcast.",
  feedUrl: "https://www.spreaker.com/show/6900001/episodes/feed",
  imagePath: "/brand/icon.png",
};

describe("seriesJsonLd", () => {
  it("describes the show as a podcast series with its feed", () => {
    expect(seriesJsonLd(series)).toEqual({
      "@context": "https://schema.org",
      "@type": "PodcastSeries",
      name: "Jester's Privilege",
      description: "A weekly theology-and-humor podcast.",
      url: "https://jestersprivilegepodcast.com/",
      webFeed: "https://www.spreaker.com/show/6900001/episodes/feed",
      image: "https://jestersprivilegepodcast.com/brand/icon.png",
    });
  });
});

describe("episodeJsonLd", () => {
  it("describes a numbered Episode, its audio, and the series it belongs to", () => {
    expect(episodeJsonLd(series, celebrityPastors)).toEqual({
      "@context": "https://schema.org",
      "@type": "PodcastEpisode",
      name: "Celebrity Pastors",
      episodeNumber: 1,
      url: "https://jestersprivilegepodcast.com/episodes/1",
      datePublished: "2026-11-09",
      description: "Why the church keeps crowning its preachers.",
      timeRequired: "PT43M12S",
      associatedMedia: {
        "@type": "MediaObject",
        contentUrl: "https://dts.podtrac.com/redirect.mp3/example.com/1.mp3",
      },
      partOfSeries: {
        "@type": "PodcastSeries",
        name: "Jester's Privilege",
        url: "https://jestersprivilegepodcast.com/",
      },
    });
  });

  it("gives an unnumbered Episode no number, and an hour-long one its hours", () => {
    const ld = episodeJsonLd(series, {
      ...christmasConfessions,
      durationSeconds: 3600 + 5,
    });
    expect(ld).not.toHaveProperty("episodeNumber");
    expect(ld).toMatchObject({
      url: "https://jestersprivilegepodcast.com/episodes/bonus/listener-confessions-christmas-edition",
      timeRequired: "PT1H0M5S",
    });
  });
});

describe("serializeJsonLd", () => {
  it("can't close the script element it sits in, whatever a feed title holds", () => {
    const text = serializeJsonLd({
      name: "</script><script>alert(1)</script>",
    });
    expect(text).not.toContain("<");
    expect(JSON.parse(text)).toEqual({
      name: "</script><script>alert(1)</script>",
    });
  });
});

describe("link-preview cards", () => {
  it("gives each Episode a card at its own address, beside the site-wide one", () => {
    expect(episodeCardPath(celebrityPastors)).toBe("/cards/episodes/1.png");
    expect(episodeCardPath(christmasConfessions)).toBe(
      "/cards/episodes/bonus/listener-confessions-christmas-edition.png"
    );
    expect(cardPaths([celebrityPastors, christmasConfessions])).toEqual([
      ["site.png"],
      ["episodes", "1.png"],
      ["episodes", "bonus", "listener-confessions-christmas-edition.png"],
    ]);
  });

  it("finds the card an address names", () => {
    const episodes = [celebrityPastors, christmasConfessions];
    expect(cardAt(["site.png"], episodes)).toEqual({ kind: "site" });
    expect(cardAt(["episodes", "1.png"], episodes)).toEqual({
      kind: "episode",
      episode: celebrityPastors,
    });
    expect(
      cardAt(
        ["episodes", "bonus", "listener-confessions-christmas-edition.png"],
        episodes
      )
    ).toEqual({ kind: "episode", episode: christmasConfessions });
  });

  it("names an address with no card", () => {
    for (const address of [
      ["episodes", "9.png"],
      ["episodes", "1"],
      ["other.png"],
    ]) {
      expect(() => cardAt(address, [celebrityPastors])).toThrow(
        `"/cards/${address.join("/")}"`
      );
    }
  });
});
