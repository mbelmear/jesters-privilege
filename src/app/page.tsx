import { DraftRibbon } from "@/components/draft-ribbon";
import { FleuronRule } from "@/components/fleuron-rule";
import { GalleryTeaser } from "@/components/gallery-teaser";
import { Hero } from "@/components/hero";
import { HeroReveal } from "@/components/hero-reveal";
import { LatestEpisode } from "@/components/latest-episode";
import { ListenButtons } from "@/components/listen-buttons";
import { MeetTheJesters } from "@/components/meet-the-jesters";
import { content, sectionHref } from "@/content";
import { feedSource, getEpisodes } from "@/content/feed";

// The home page as the Jesters approved it at the mockup gate (#14), with the
// jester story revealed a paragraph at a time as the visitor scrolls (#58).
export default async function Home() {
  const { site, shell, hero, home, jesters, microcopy, paintings } = content;
  const [latest] = await getEpisodes();
  return (
    <div className="flex flex-col gap-16 pb-20 sm:gap-20">
      <DraftRibbon
        uses={[
          shell,
          site,
          hero,
          home,
          jesters,
          microcopy.newToPodcasts,
          microcopy.comingSoon,
          paintings.stanczyk,
          feedSource,
        ]}
      />
      <Hero logo={hero.logo} name={site.name}>
        <HeroReveal paragraphs={hero.paragraphs} />
      </Hero>
      <ListenButtons
        links={site.listen}
        copy={home.listen}
        newToPodcasts={microcopy.newToPodcasts}
      />
      <FleuronRule className="mx-auto w-full max-w-xs px-4" />
      <LatestEpisode
        episode={latest}
        copy={home.latestEpisode}
        comingSoon={microcopy.comingSoon}
        playerCopy={shell.player}
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
