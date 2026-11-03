import { getEpisodes } from "@/content/feed";
import { cardAt, cardPaths } from "@/lib/seo";
import { episodeCard } from "../../_cards/episode-card";
import { siteCard } from "../../_cards/site-card";

// The link-preview cards, drawn at build time: /cards/site.png, and one per
// Episode at /cards/episodes/<its address>.png. They live here rather than in
// opengraph-image files, which Next can't place under the Episodes' catch-all
// route; the site card keeps this route from ever building empty.
export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  return cardPaths(await getEpisodes()).map((card) => ({ card }));
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/cards/[...card]">
) {
  const card = cardAt((await params).card, await getEpisodes());
  switch (card.kind) {
    case "site":
      return siteCard();
    case "episode":
      return episodeCard(card.episode);
    default: {
      const unhandled: never = card;
      return unhandled;
    }
  }
}
