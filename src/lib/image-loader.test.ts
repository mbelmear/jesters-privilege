import imageLoader from "./image-loader";

describe("imageLoader", () => {
  it("points a next/image srcset width at the build's WebP file", () => {
    expect(imageLoader({ src: "/jesters/dan-collins.jpg", width: 384 })).toBe(
      "/images/jesters/dan-collins/384.webp"
    );
  });
});
