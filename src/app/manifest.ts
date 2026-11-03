import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MetadataRoute } from "next";
import { content } from "@/content";
import { palette } from "@/lib/palette";

export const dynamic = "force-static";

// Lets Android add the site to the home screen with the logo mark, on
// parchment as the Apple icon is. Opens in the browser like any page.
export default function manifest(): MetadataRoute.Manifest {
  const color = palette(
    readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8")
  );
  const { site } = content;
  return {
    name: site.name,
    short_name: site.name,
    description: site.description.text,
    start_url: "/",
    display: "browser",
    background_color: color("parchment"),
    theme_color: color("parchment"),
    icons: [192, 512].map((size) => ({
      src: `/brand/app-icon-${size}.png`,
      sizes: `${size}x${size}`,
      type: "image/png",
    })),
  };
}
