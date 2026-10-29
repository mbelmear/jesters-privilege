import {
  IMAGE_FORMATS,
  IMAGE_WIDTHS,
  cropAround,
  imageUrl,
  planImage,
} from "./images";

describe("planImage", () => {
  const logo = { src: "/brand/logo-draft.png", width: 583, height: 294 };
  const stanczyk = {
    src: "/paintings/stanczyk.jpg",
    width: 2400,
    height: 1785,
    focalPoint: { x: 0.52, y: 0.4 },
  };

  it("makes every width a page can ask for, in every format", () => {
    const urls = planImage(logo).map((variant) => variant.url);
    for (const width of IMAGE_WIDTHS) {
      for (const format of IMAGE_FORMATS) {
        expect(urls).toContain(imageUrl({ src: logo.src, width, format }));
      }
    }
  });

  it("never enlarges: a width past the source is made at the source's size", () => {
    expect(planImage(logo)).toContainEqual({
      url: "/images/brand/logo-draft/256.webp",
      format: "webp",
      width: 256,
    });
    expect(planImage(logo)).toContainEqual({
      url: "/images/brand/logo-draft/2048.avif",
      format: "avif",
      width: 583,
    });
  });

  it("cuts no crops from an image without a focal point", () => {
    expect(planImage(logo).filter((variant) => variant.crop)).toEqual([]);
  });

  it("cuts the portrait crop around a painting's focal point", () => {
    expect(planImage(stanczyk)).toContainEqual({
      url: "/images/paintings/stanczyk/portrait-828.avif",
      format: "avif",
      width: 828,
      crop: { left: 534, top: 0, width: 1428, height: 1785 },
    });
    expect(planImage(stanczyk)).toContainEqual({
      url: "/images/paintings/stanczyk/portrait-1600.webp",
      format: "webp",
      width: 1428,
      crop: { left: 534, top: 0, width: 1428, height: 1785 },
    });
  });
});

describe("cropAround", () => {
  const stanczyk = { width: 2400, height: 1785 };

  it("cuts the tallest portrait from a landscape, centred on the focal point", () => {
    expect(cropAround(stanczyk, { x: 0.52, y: 0.4 }, "portrait")).toEqual({
      left: 534,
      top: 0,
      width: 1428,
      height: 1785,
    });
  });

  it("slides the crop back inside the image near an edge", () => {
    expect(cropAround(stanczyk, { x: 0.05, y: 0.4 }, "portrait").left).toBe(0);
    expect(cropAround(stanczyk, { x: 0.98, y: 0.4 }, "portrait").left).toBe(
      972
    );
  });

  it("cuts the widest crop from an image taller than the crop", () => {
    expect(
      cropAround({ width: 1391, height: 2400 }, { x: 0.55, y: 0.5 }, "portrait")
    ).toEqual({ left: 0, top: 331, width: 1391, height: 1739 });
  });
});

describe("imageUrl", () => {
  it("names a generated width and format beside the image's public path", () => {
    expect(
      imageUrl({ src: "/paintings/stanczyk.jpg", width: 828, format: "avif" })
    ).toBe("/images/paintings/stanczyk/828.avif");
  });

  it("names a crop's files apart from the whole image's", () => {
    expect(
      imageUrl({
        src: "/paintings/stanczyk.jpg",
        width: 640,
        format: "webp",
        crop: "portrait",
      })
    ).toBe("/images/paintings/stanczyk/portrait-640.webp");
  });
});
