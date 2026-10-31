import Link from "next/link";
import { DraftRibbon } from "@/components/draft-ribbon";
import { FleuronRule } from "@/components/fleuron-rule";
import { GalleryTeaser } from "@/components/gallery-teaser";
import { Hero } from "@/components/hero";
import { LatestEpisode } from "@/components/latest-episode";
import { ListenButtons } from "@/components/listen-buttons";
import { MeetTheJesters } from "@/components/meet-the-jesters";
import { content, sectionHref } from "@/content";
import { feedSource, getEpisodes } from "@/content/feed";
import { styleguide } from "@/content/styleguide";
import { cn } from "@/lib/utils";

const copy = styleguide.home;

// The two ways the home page can tell the jester story, for the Jesters to
// choose between: each paragraph rising into view as the visitor scrolls to
// it, or all of it simply there.
const HERO_OPTIONS = ["reveal", "simple"] as const;
type HeroOption = (typeof HERO_OPTIONS)[number];

type Props = {
  heroOption: HeroOption;
  // The jester story as that option tells it. Each page passes its own, so
  // only the reveal's page ships Motion.
  story: React.ReactNode;
};

/**
 * The home page as designed at the mockup gate (#14), with the fixture's
 * Episodes and placeholder Listen links. A bar above it switches between the
 * two hero options, each at its own address.
 */
export async function HomePreview({ heroOption, story }: Props) {
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
          copy,
          feedSource,
        ]}
      />
      <div>
        <nav
          aria-label={copy.heroSwitch.label}
          className="flex flex-wrap items-center justify-center gap-3 border-b bg-muted px-4 py-2 font-ui text-sm font-semibold"
        >
          <span className="text-muted-foreground">{copy.heroSwitch.label}</span>
          <ul className="flex gap-1">
            {HERO_OPTIONS.map((name) => {
              const option = copy.heroSwitch.options[name];
              const current = name === heroOption;
              return (
                <li key={name}>
                  <Link
                    href={option.href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "inline-block rounded-md px-3 py-1.5",
                      current
                        ? "bg-primary text-primary-foreground"
                        : "text-primary underline underline-offset-4"
                    )}
                  >
                    {option.text}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <Hero logo={hero.logo} name={site.name}>
          {story}
        </Hero>
      </div>
      <ListenButtons
        links={copy.listen}
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
