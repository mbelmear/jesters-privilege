import { parseScreenshotArgs } from "./screenshot-args";

describe("parseScreenshotArgs", () => {
  it("takes the page and folder, and nothing else by default", () => {
    expect(parseScreenshotArgs(["/about", ".screenshots/about"])).toEqual({
      positional: ["/about", ".screenshots/about"],
      steps: [],
      storage: [],
      elements: [],
      missing: false,
      submit: null,
      grantClipboard: false,
    });
  });

  // A sent form takes typing, a ticked box, and Send, in that order.
  it("keeps clicks, fills, and the audio drop in the order given", () => {
    const { steps } = parseScreenshotArgs([
      "/speak-freely",
      "--fill",
      "Message=Why skinny jeans? A = B",
      "--click",
      "You can mention this on the show.",
      "--click",
      "Send",
      "--drop-audio",
    ]);

    expect(steps).toEqual([
      { kind: "fill", label: "Message", text: "Why skinny jeans? A = B" },
      { kind: "click", name: "You can mention this on the show." },
      { kind: "click", name: "Send" },
      { kind: "drop-audio" },
    ]);
  });

  it("answers the submit endpoint with a status and JSON body", () => {
    expect(
      parseScreenshotArgs([
        "/speak-freely",
        "--submit",
        '502={"ok":false,"error":"delivery"}',
        "--click",
        "Send",
      ]).submit
    ).toEqual({ status: 502, body: { ok: false, error: "delivery" } });
  });

  it.each([
    ["no status", '={"ok":true}'],
    ["a status that isn't one", 'ok={"ok":true}'],
    ["a body that isn't JSON", "200=ok"],
  ])("refuses a --submit with %s", (_, value) => {
    expect(() =>
      parseScreenshotArgs(["/", "--submit", value, "--click", "Send"])
    ).toThrow(/--submit needs <status>=<json>/);
  });

  // Answered, the endpoint waits on a send that no step makes.
  it("refuses a --submit with no steps to send it", () => {
    expect(() =>
      parseScreenshotArgs(["/speak-freely", "--submit", '200={"ok":true}'])
    ).toThrow(/--submit needs steps that send the form/);
  });

  it("grants the clipboard", () => {
    expect(
      parseScreenshotArgs(["/episodes/1", "--grant", "clipboard"])
        .grantClipboard
    ).toBe(true);
  });

  it("refuses a permission it doesn't know", () => {
    expect(() => parseScreenshotArgs(["/", "--grant", "geolocation"])).toThrow(
      /--grant takes only clipboard/
    );
  });

  it("refuses a --fill without a label", () => {
    expect(() => parseScreenshotArgs(["/", "--fill", "=text"])).toThrow(
      /--fill needs <label>=<text>/
    );
  });

  it("keeps storage entries, element selectors, and --missing", () => {
    expect(
      parseScreenshotArgs([
        "/nowhere",
        "--storage",
        'player={"finished":[]}',
        "--element",
        "footer",
        "--missing",
      ])
    ).toMatchObject({
      storage: [["player", '{"finished":[]}']],
      elements: ["footer"],
      missing: true,
    });
  });

  it("refuses an option with no value", () => {
    expect(() => parseScreenshotArgs(["/", "--click"])).toThrow(
      "--click needs a value"
    );
  });
});
