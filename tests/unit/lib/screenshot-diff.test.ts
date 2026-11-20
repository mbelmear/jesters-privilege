import { compareImages, describeDifference } from "@/lib/screenshot-diff";

// A width × height image of one colour, RGBA.
function image(width: number, height: number, rgba = [255, 255, 255, 255]) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
  return { width, height, data };
}

function paint(
  img: ReturnType<typeof image>,
  x: number,
  y: number,
  rgba = [0, 0, 0, 255]
) {
  img.data.set(rgba, (y * img.width + x) * 4);
}

describe("compareImages", () => {
  it("finds two images of the same pixels the same", () => {
    expect(compareImages(image(4, 3), image(4, 3))).toEqual({ kind: "same" });
  });

  it("bounds every changed pixel in one rectangle", () => {
    const after = image(10, 8);
    paint(after, 2, 3);
    paint(after, 6, 5);
    expect(compareImages(image(10, 8), after)).toEqual({
      kind: "changed",
      region: { x: 2, y: 3, width: 5, height: 3 },
    });
  });

  it("counts a change in transparency alone", () => {
    const after = image(4, 4);
    paint(after, 1, 1, [255, 255, 255, 0]);
    expect(compareImages(image(4, 4), after)).toEqual({
      kind: "changed",
      region: { x: 1, y: 1, width: 1, height: 1 },
    });
  });

  // A full-page shot grows when anything above the fold gets taller.
  it("reports a change of size rather than comparing pixels", () => {
    expect(compareImages(image(4, 3), image(4, 5))).toEqual({
      kind: "resized",
      before: { width: 4, height: 3 },
      after: { width: 4, height: 5 },
    });
  });
});

describe("describeDifference", () => {
  it("names each kind of difference on one line", () => {
    expect(describeDifference("phone-light.png", { kind: "same" })).toBe(
      "same     phone-light.png"
    );
    expect(
      describeDifference("phone-light.png", {
        kind: "changed",
        region: { x: 298, y: 750, width: 236, height: 40 },
      })
    ).toBe("changed  phone-light.png  236×40 at (298, 750)");
    expect(
      describeDifference("phone-light.png", {
        kind: "resized",
        before: { width: 780, height: 4000 },
        after: { width: 780, height: 4100 },
      })
    ).toBe("resized  phone-light.png  780×4000 → 780×4100");
  });
});
