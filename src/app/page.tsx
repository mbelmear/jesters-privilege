import type { Metadata } from "next";
import { DraftRibbon } from "@/components/draft-ribbon";
import { FleuronRule } from "@/components/fleuron-rule";
import { GalleryTeaser } from "@/components/gallery-teaser";
import { Hero } from "@/components/hero";
import { HeroReveal } from "@/components/hero-reveal";
import { JsonLd } from "@/components/json-ld";
import { EpisodeListenLinks } from "@/components/episode-listen-links";
import { LatestEpisode } from "@/components/latest-episode";
import { MeetTheJesters } from "@/components/meet-the-jesters";
import { content, sectionHref } from "@/content";
import { feedSource, getEpisodeListenLinks, getEpisodes } from "@/content/feed";
import { series } from "@/content/series";
import { pageMetadata, seriesJsonLd } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(content.site, {
  path: "/",
  description: content.site.description.text,
});

// The home page as the Jesters approved it at the mockup gate (#14), with the
// jester story revealed a paragraph at a time as the visitor scrolls (#58).
export default async function Home() {
  const { site, shell, hero, home, jesters, listen, microcopy, paintings } =
    content;
  const [latest] = await getEpisodes();
  const listenLinks = latest ? await getEpisodeListenLinks(latest) : [];
  return (
    <div className="flex flex-col gap-16 pb-20 sm:gap-20">
      <DraftRibbon
        uses={[
          shell,
          site,
          hero,
          home,
          listen,
          jesters,
          microcopy.comingSoon,
          paintings.stanczyk,
          feedSource,
        ]}
      />
      <JsonLd data={seriesJsonLd(series)} />
      <Hero logo={hero.logo} name={site.name}>
        <HeroReveal paragraphs={hero.paragraphs} />
      </Hero>
      <FleuronRule className="mx-auto w-full max-w-xs px-4" />
      <LatestEpisode
        episode={latest}
        copy={home.latestEpisode}
        comingSoon={microcopy.comingSoon}
        playerCopy={shell.player}
        listenLinks={<EpisodeListenLinks links={listenLinks} copy={listen} />}
      />
      <GalleryTeaser
        painting={paintings.stanczyk}
        copy={home.gallery}
        galleryHref={sectionHref("Fools' Gallery")}
      />
      <FleuronRule className="mx-auto w-full max-w-xs px-4" />
      <MeetTheJesters
        jesters={jesters}
        copy={home.jesters}
        aboutHref={sectionHref("About")}
      />
    </div>
  );
}
