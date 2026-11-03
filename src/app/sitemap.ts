import type { MetadataRoute } from "next";
import { content } from "@/content";
import { getEpisodes } from "@/content/feed";
import { sitemapEntries } from "@/lib/seo";

export const dynamic = "force-static";

// Every public page: home, each section in the site's navigation, and each
// Episode. The style guide stays out (it's noindex too).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { site, shell } = content;
  const sections = shell.nav.map((item) => item.href);
  return sitemapEntries(site, ["/", ...sections], await getEpisodes());
}
