import type { Series } from "@/lib/seo";
import { feedUrl } from "@/lib/feed-source";
import { feedSource } from "./feed";
import { site } from "./site";

// The show as search engines' structured data describes it (src/lib/seo.ts).
export const series: Series = {
  site,
  description: site.description.text,
  feedUrl: feedUrl(feedSource),
  imagePath: "/brand/icon.png",
};
