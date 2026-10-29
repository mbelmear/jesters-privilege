import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
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
