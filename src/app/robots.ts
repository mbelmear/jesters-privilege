import type { MetadataRoute } from "next";
import { content } from "@/content";

export const dynamic = "force-static";

// Everything may be crawled. The style guide's pages say noindex themselves;
// disallowing them here would stop crawlers from reading that, and a page
// linked from elsewhere could then be listed anyway.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: new URL("/sitemap.xml", content.site.url).href,
  };
}
