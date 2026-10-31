import {
  assertPublicDomain,
  assertSlug,
  commonsTitle,
  detailRect,
  paintingEntry,
  parseCommonsFile,
  parseDetail,
} from "./commons";

const edit =
  '<span class="noprint"><a href="https://www.wikidata.org/wiki/Q6609268"><img alt="Edit this at Wikidata" src="x.png"></a></span>';

// Trimmed from the Commons API's answer for Matejko's Stańczyk
// (action=query, prop=imageinfo, formatversion=2, iiurlwidth and
// iiurlheight 2400; Commons rounds the copy up to its 3840px standard size).
const stanczyk = {
  query: {
    pages: [
      {
        title: "File:Jan Matejko, Stańczyk.jpg",
        imageinfo: [
          {
            width: 5766,
            height: 4289,
            url: "https://upload.wikimedia.org/wikipedia/commons/7/78/Jan_Matejko%2C_Sta%C5%84czyk.jpg?utm_source=commons.wikimedia.org",
            thumburl:
              "https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Jan_Matejko%2C_Sta%C5%84czyk.jpg/3840px-Jan_Matejko%2C_Sta%C5%84czyk.jpg",
            descriptionurl:
              "https://commons.wikimedia.org/wiki/File:Jan_Matejko,_Sta%C5%84czyk.jpg",
            extmetadata: {
              ObjectName: {
                value: `<div class="fn"><div><i>Stańczyk\u00a0${edit}</i></div><div style="display: none;">label QS:Len,"Stańczyk (Stańczyk during a ball)"</div></div>`,
              },
              Artist: {
                value:
                  '<bdi><a href="https://en.wikipedia.org/wiki/en:Jan_Matejko"><span title="Polish painter (1838–1893)">Jan Matejko</span></a></bdi>',
              },
              DateTimeOriginal: { value: `1862\u00a0${edit}` },
              LicenseShortName: { value: "Public domain" },
            },
          },
        ],
      },
    ],
  },
};

describe("parseCommonsFile", () => {
  // The resized copy, not the original: a scan such as the Google Art
  // Project's 30,000px Ambassadors is too large for sharp to open.
  it("reads the resized copy's address, size, license, and visible placard text", () => {
    expect(parseCommonsFile(stanczyk)).toEqual({
      fileTitle: "File:Jan Matejko, Stańczyk.jpg",
      downloadUrl:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Jan_Matejko%2C_Sta%C5%84czyk.jpg/3840px-Jan_Matejko%2C_Sta%C5%84czyk.jpg",
      pageUrl:
        "https://commons.wikimedia.org/wiki/File:Jan_Matejko,_Sta%C5%84czyk.jpg",
      width: 5766,
      height: 4289,
      license: "Public domain",
      paintingTitle: "Stańczyk",
      artist: "Jan Matejko",
      date: "1862",
    });
  });

  it("leaves out metadata the file page doesn't give", () => {
    const [page] = stanczyk.query.pages;
    const [info] = page.imageinfo;
    const bare = {
      query: {
        pages: [
          {
            ...page,
            imageinfo: [
              {
                ...info,
                extmetadata: { LicenseShortName: { value: "Public domain" } },
              },
            ],
          },
        ],
      },
    };
    const file = parseCommonsFile(bare);
    expect([file.paintingTitle, file.artist, file.date]).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("refuses a title Commons has no file for", () => {
    expect(() =>
      parseCommonsFile({
        query: { pages: [{ title: "File:Nobody.jpg", missing: true }] },
      })
    ).toThrow("Commons has no file File:Nobody.jpg");
  });

  it("refuses an answer that isn't the shape it expects", () => {
    expect(() => parseCommonsFile({ error: { code: "badtitle" } })).toThrow(
      "Commons answered without a file page"
    );
  });

  it("names the field it couldn't read, and the file", () => {
    const [page] = stanczyk.query.pages;
    const [info] = page.imageinfo;
    const sizeless = { ...info, width: undefined };
    expect(() =>
      parseCommonsFile({
        query: { pages: [{ ...page, imageinfo: [sizeless] }] },
      })
    ).toThrow("Commons gave no width for File:Jan Matejko, Stańczyk.jpg");
  });
});

describe("assertPublicDomain", () => {
  it("passes a public-domain file and refuses any other license", () => {
    const file = parseCommonsFile(stanczyk);
    expect(() => assertPublicDomain(file)).not.toThrow();
    expect(() =>
      assertPublicDomain({ ...file, license: "CC BY-SA 4.0" })
    ).toThrow(
      'File:Jan Matejko, Stańczyk.jpg is licensed "CC BY-SA 4.0", not public domain'
    );
  });

  // The British Library dedicates its scans, such as the Psalter of Henry
  // VIII, to the public domain with CC0.
  it("passes a file dedicated to the public domain with CC0", () => {
    const file = parseCommonsFile(stanczyk);
    expect(() => assertPublicDomain({ ...file, license: "CC0" })).not.toThrow();
  });
});

describe("paintingEntry", () => {
  it("writes a catalogue entry, leaving out or empty what a person must add", () => {
    const file = parseCommonsFile(stanczyk);
    expect(paintingEntry("stanczyk", file, { width: 2400, height: 1785 })).toBe(
      `  stanczyk: {
    src: "/paintings/stanczyk.jpg",
    width: 2400,
    height: 1785,
    source:
      "https://commons.wikimedia.org/wiki/File:Jan_Matejko,_Sta%C5%84czyk.jpg",
    alt: "",
    // focalPoint: { x: , y: },
    placard: {
      artist: "Jan Matejko",
      title: "Stańczyk",
      year: "1862",
      medium: "",
      collection: "",
    },
  },`
    );
  });

  it("says how a detail was cut, so it can be cut again", () => {
    const file = parseCommonsFile(stanczyk);
    expect(
      paintingEntry(
        "stanczyk",
        file,
        { width: 1136, height: 937 },
        "0,0,0.6,0.333"
      )
    ).toMatch(
      /^ {2}\/\/ A detail of the Commons file, cut with --detail 0,0,0\.6,0\.333\.\n {2}stanczyk: \{/
    );
  });

  it("quotes a slug that isn't a plain identifier", () => {
    const file = parseCommonsFile(stanczyk);
    expect(
      paintingEntry("pablo-de-valladolid", file, { width: 1391, height: 2400 })
    ).toMatch(/^ {2}"pablo-de-valladolid": \{/);
  });
});

describe("commonsTitle", () => {
  it.each([
    ["File:Jan Matejko, Stańczyk.jpg", "File:Jan Matejko, Stańczyk.jpg"],
    [
      "https://commons.wikimedia.org/wiki/File:Jan_Matejko,_Sta%C5%84czyk.jpg",
      "File:Jan_Matejko,_Stańczyk.jpg",
    ],
  ])("takes a file title or its page address: %s", (input, title) => {
    expect(commonsTitle(input)).toBe(title);
  });

  it("refuses anything else", () => {
    expect(() => commonsTitle("https://example.com/stanczyk.jpg")).toThrow(
      'Expected a Commons file title ("File:…") or file page address, not "https://example.com/stanczyk.jpg"'
    );
  });
});

describe("assertSlug", () => {
  it.each(["stanczyk", "will-somers", "el-primo-2"])("passes %s", (slug) => {
    expect(() => assertSlug(slug)).not.toThrow();
  });

  it.each(["Will Somers", "will_somers", "-somers", ""])(
    "refuses %p",
    (slug) => {
      expect(() => assertSlug(slug)).toThrow(
        `A painting's slug is lowercase words joined by hyphens, such as will-somers, not "${slug}"`
      );
    }
  );
});

describe("parseDetail", () => {
  it("reads left, top, width, and height as fractions of the file", () => {
    expect(parseDetail("0,0,0.6,0.333")).toEqual({
      left: 0,
      top: 0,
      width: 0.6,
      height: 0.333,
    });
  });

  it.each(["0,0,0.6", "0,0,1.2,0.5", "0.5,0,0.6,0.5", "a,b,c,d"])(
    "refuses a region that isn't four fractions inside the file: %s",
    (arg) => {
      expect(() => parseDetail(arg)).toThrow(
        `--detail is left,top,width,height as fractions of the file, inside it, such as 0,0,0.6,0.33, not "${arg}"`
      );
    }
  );
});

describe("detailRect", () => {
  it("cuts the region in whole pixels", () => {
    expect(
      detailRect(
        { width: 1894, height: 2815 },
        { left: 0, top: 0, width: 0.6, height: 0.333 }
      )
    ).toEqual({ left: 0, top: 0, width: 1136, height: 937 });
  });

  it("keeps a region that reaches the edge inside the file", () => {
    expect(
      detailRect(
        { width: 5, height: 5 },
        { left: 0.3, top: 0.3, width: 0.7, height: 0.7 }
      )
    ).toEqual({ left: 2, top: 2, width: 3, height: 3 });
  });

  it("refuses a detail too small to keep a pixel of the file", () => {
    expect(() =>
      detailRect(
        { width: 100, height: 100 },
        { left: 0.5, top: 0, width: 0.001, height: 1 }
      )
    ).toThrow("--detail keeps no pixels of a 100×100 file; widen the region");
  });
});
