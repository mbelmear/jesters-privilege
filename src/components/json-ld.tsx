import { serializeJsonLd } from "@/lib/seo";

// Structured data for search engines, in the page's built HTML.
export function JsonLd({
  data,
}: {
  data: Parameters<typeof serializeJsonLd>[0];
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
