import {
  assertPublicDomain,
  commonsTitle,
  paintingEntry,
  parseCommonsFile,
} from "./commons";

const edit =
  '<span class="noprint"><a href="https://www.wikidata.org/wiki/Q6609268"><img alt="Edit this at Wikidata" src="x.png"></a></span>';

// Trimmed from the Commons API's answer for Matejko's Stańczyk
// (action=query, prop=imageinfo, formatversion=2).
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
            descriptionurl:
              "https://commons.wikimedia.org/wiki/File:Jan_Matejko,_Sta%C5%84czyk.jpg",
            extmetadata: {
              ObjectName: {
                value: `<div class="fn"><div><i>Stańczyk ${edit}</i></div><div style="display: none;">label QS:Len,"Stańczyk (Stańczyk during a ball)"</div></div>`,
              },
              Artist: {
                value:
                  '<bdi><a href="https://en.wikipedia.org/wiki/en:Jan_Matejko"><span title="Polish painter (1838–1893)">Jan Matejko</span></a></bdi>',
              },
              DateTimeOriginal: { value: `1862 ${edit}` },
              LicenseShortName: { value: "Public domain" },
            },
          },
        ],
      },
    ],
  },
};

describe("parseCommonsFile", () => {
  it("reads a file's address, size, license, and visible placard text", () => {
    expect(parseCommonsFile(stanczyk)).toEqual({
      title: "File:Jan Matejko, Stańczyk.jpg",
      fileUrl:
        "https://upload.wikimedia.org/wikipedia/commons/7/78/Jan_Matejko%2C_Sta%C5%84czyk.jpg?utm_source=commons.wikimedia.org",
      pageUrl:
        "https://commons.wikimedia.org/wiki/File:Jan_Matejko,_Sta%C5%84czyk.jpg",
      width: 5766,
      height: 4289,
      license: "Public domain",
      name: "Stańczyk",
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
    expect([file.name, file.artist, file.date]).toEqual([
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
      "Commons answered without image info"
    );
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
});

describe("paintingEntry", () => {
  it("writes a catalogue entry, leaving what a person must add empty", () => {
    const file = parseCommonsFile(stanczyk);
    expect(paintingEntry("stanczyk", file, { width: 2400, height: 1785 })).toBe(
      `  stanczyk: {
    src: "/paintings/stanczyk.jpg",
    width: 2400,
    height: 1785,
    source:
      "https://commons.wikimedia.org/wiki/File:Jan_Matejko,_Sta%C5%84czyk.jpg",
    alt: "",
    focalPoint: { x: 0.5, y: 0.5 },
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
