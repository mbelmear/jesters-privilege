import type { Series } from "@/lib/seo";
import { feed } from "./feed";
import { site } from "./site";

// The show as search engines' structured data describes it (src/lib/seo.ts).
export const series: Series = {
  site,
  description: site.description.text,
  feedUrl: feed.address,
  imagePath: "/brand/icon.png",
};
