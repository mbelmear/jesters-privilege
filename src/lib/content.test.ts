import {
  findDrafts,
  findImages,
  validateContent,
  type Content,
  type Painting,
} from "./content";
import { shell } from "@/content/shell";

const painting: Painting = {
  src: "/paintings/stanczyk.jpg",
  width: 2400,
  height: 1785,
  source:
    "https://commons.wikimedia.org/wiki/File:Jan_Matejko,_Sta%C5%84czyk.jpg",
  alt: "Stańczyk slumped in a chair while a ball goes on in the next room",
  focalPoint: { x: 0.45, y: 0.4 },
  placard: {
    artist: "Jan Matejko",
    title: "Stańczyk",
    year: "1862",
    medium: "Oil on canvas",
    collection: "National Museum, Warsaw",
  },
};

const section = { title: "Why a jester", paragraphs: ["In every court…"] };

// Valid content, overridden piece by piece to break one rule per test.
function content(overrides: Partial<Content> = {}): Content {
  return {
    site: {
      name: "Jester's Privilege",
      tagline: "Theology in the Motley.",
      description: { text: "A weekly theology-and-humor podcast." },
      contactEmail: "hello@jestersprivilegepodcast.com",
      listen: { spotify: "https://open.spotify.com/show/abc" },
      social: {},
    },
    paintings: { stanczyk: painting },
    shell,
    hero: { paragraphs: ["Long ago…"] },
    jesters: [{ id: "dan", name: "Dan Collins", role: "Co-host" }],
    gallery: {
      eras: [
        {
          id: "renaissance",
          title: "The Renaissance",
          period: "1400–1600",
          intro: section,
        },
      ],
      fools: [
        {
          slug: "stanczyk",
          name: "Stańczyk",
          era: "renaissance",
          lived: "c. 1480–1560",
          story: section,
          painting,
        },
      ],
      closing: section,
    },
    about: {
      whyAJester: section,
      whatWeBelieve: section,
      church: section,
      howToListen: section,
    },
    microcopy: { comingSoon: { text: "Episode 1 is on its way." } },
    ...overrides,
  };
}

describe("validateContent", () => {
  it("returns valid content unchanged", () => {
    const valid = content();
    expect(validateContent(valid)).toBe(valid);
  });

  it("refuses an empty string, naming where it is", () => {
    expect(() =>
      validateContent(content({ hero: { paragraphs: ["Long ago…", "  "] } }))
    ).toThrow("Content hero.paragraphs[1] is empty");
  });

  it.each(["open.spotify.com/show/abc", "http://open.spotify.com/show/abc"])(
    "refuses a link that isn't an https URL: %s",
    (link) => {
      const valid = content();
      expect(() =>
        validateContent(
          content({ site: { ...valid.site, listen: { spotify: link } } })
        )
      ).toThrow(
        `Content site.listen.spotify must be an https URL, not "${link}"`
      );
    }
  );

  it("refuses a focal point outside the painting", () => {
    const valid = content();
    const band = { ...painting, focalPoint: { x: 0.5, y: 1.2 } };
    expect(() =>
      validateContent(
        content({
          gallery: {
            ...valid.gallery,
            eras: [{ ...valid.gallery.eras[0], band }],
          },
        })
      )
    ).toThrow(
      "Content gallery.eras[renaissance].band.focalPoint must lie within the painting (x and y from 0 to 1), not (0.5, 1.2)"
    );
  });

  it("checks every painting in the catalogue, naming it by id", () => {
    const focalPoint = { x: -0.1, y: 0.4 };
    expect(() =>
      validateContent(
        content({ paintings: { stanczyk: { ...painting, focalPoint } } })
      )
    ).toThrow(
      "Content paintings.stanczyk.focalPoint must lie within the painting (x and y from 0 to 1), not (-0.1, 0.4)"
    );
  });

  it("refuses a painting whose source isn't a Wikimedia Commons file page", () => {
    const valid = content();
    const source = "https://example.com/stanczyk.jpg";
    expect(() =>
      validateContent(
        content({
          gallery: {
            ...valid.gallery,
            fools: [
              { ...valid.gallery.fools[0], painting: { ...painting, source } },
            ],
          },
        })
      )
    ).toThrow(
      `Content gallery.fools[stanczyk].painting.source must be a Wikimedia Commons file page recording its public-domain status, not "${source}"`
    );
  });

  it("refuses a Fool in an era the Gallery doesn't show", () => {
    const valid = content();
    expect(() =>
      validateContent(
        content({
          gallery: {
            ...valid.gallery,
            fools: [{ ...valid.gallery.fools[0], era: "reformation" }],
          },
        })
      )
    ).toThrow(
      "Content gallery.fools[stanczyk].era is \"reformation\", which isn't one of the Gallery's eras"
    );
  });

  it("refuses two list items with the same id or slug", () => {
    const valid = content();
    const [fool] = valid.gallery.fools;
    expect(() =>
      validateContent(
        content({
          gallery: {
            ...valid.gallery,
            fools: [fool, { ...fool, name: "Stańczyk again" }],
          },
        })
      )
    ).toThrow('Content gallery.fools has two items named "stanczyk"');
  });
});

describe("findDrafts", () => {
  it("reports where each draft sits, naming list items by id or slug", () => {
    const content = {
      hero: { paragraphs: ["Long ago…"] },
      jesters: [
        { id: "dan", name: "Dan Collins", bio: { text: "…", draft: true } },
        { id: "aaron", name: "Aaron Canen" },
      ],
      gallery: { fools: [{ slug: "stanczyk", story: { draft: true } }] },
      feed: { kind: "fixture", draft: true },
    } as const;

    expect(findDrafts(content)).toEqual([
      "jesters[dan].bio",
      "gallery.fools[stanczyk].story",
      "feed",
    ]);
  });

  it("finds nothing in final content", () => {
    expect(findDrafts({ hero: { paragraphs: ["Long ago…"] } })).toEqual([]);
  });
});

describe("findImages", () => {
  const logo = { src: "/brand/logo-draft.png", width: 583, height: 294 };

  it("finds every image the site shows, with where it sits", () => {
    const valid = content();
    expect(findImages(content({ shell: { ...valid.shell, logo } }))).toEqual([
      {
        contentPath: "paintings.stanczyk",
        src: "/paintings/stanczyk.jpg",
        width: 2400,
        height: 1785,
        focalPoint: { x: 0.45, y: 0.4 },
      },
      { contentPath: "shell.logo", ...logo },
    ]);
  });

  it("finds an image shown in several places once", () => {
    const valid = content();
    const found = findImages(
      content({
        gallery: {
          ...valid.gallery,
          eras: [{ ...valid.gallery.eras[0], band: painting }],
        },
      })
    );
    expect(found.filter((image) => image.src === painting.src)).toEqual([
      expect.objectContaining({ contentPath: "paintings.stanczyk" }),
    ]);
  });

  it("refuses one file given two sizes or focal points, naming both places", () => {
    const valid = content();
    const band = { ...painting, focalPoint: { x: 0.6, y: 0.4 } };
    expect(() =>
      findImages(
        content({
          gallery: {
            ...valid.gallery,
            eras: [{ ...valid.gallery.eras[0], band }],
          },
        })
      )
    ).toThrow(
      "Content paintings.stanczyk and gallery.eras[renaissance].band both show /paintings/stanczyk.jpg but describe it differently"
    );
  });
});
