import { imageUrl } from "./images";

// next/image's loader (images.loaderFile in next.config.ts): points each
// srcset width at the WebP file the build made. Components that also offer
// AVIF or a crop pass their own loader built on imageUrl.
export default function imageLoader({
  src,
  width,
}: {
  src: string;
  width: number;
}): string {
  return imageUrl({ src, width, format: "webp" });
}
