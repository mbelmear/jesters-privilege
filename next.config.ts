import type { NextConfig } from "next";
import { IMAGE_SIZES } from "./src/lib/images";

const nextConfig: NextConfig = {
  output: "export",
  // A static export has no image server, so next/image points at the files
  // scripts/images.ts makes at build time, at these widths only.
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    deviceSizes: [...IMAGE_SIZES.deviceSizes],
    imageSizes: [...IMAGE_SIZES.imageSizes],
  },
  // ESM-only parsers used by the Feed module, listed so Jest (via next/jest)
  // transforms them too.
  transpilePackages: [
    "htmlparser2",
    "domhandler",
    "domutils",
    "domelementtype",
    "dom-serializer",
    "entities",
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
