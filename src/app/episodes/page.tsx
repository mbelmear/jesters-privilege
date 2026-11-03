import type { Metadata } from "next";
import { DraftRibbon } from "@/components/draft-ribbon";
import { EpisodeArchive } from "@/components/episode-archive";
import { FinishedMark } from "@/components/finished-mark";
import { LatestEpisode } from "@/components/latest-episode";
import { content } from "@/content";
import { feedSource, getEpisodes } from "@/content/feed";
import { archiveOf } from "@/lib/archive";

const { episodes } = content;

export const metadata: Metadata = {
  title: episodes.title,
  description: episodes.intro.text,
};

// The Episodes archive, the hymnal index: the newest Episode featured as the
// only large card, then the rest by year, each playable in place. Before
// Episode 1 is published, the card says it's on its way.
export default async function Episodes() {
  // Read as the page renders, so a test can swap in other content.
  const { shell, site, home, episodePage, microcopy } = content;
  const archive = archiveOf(await getEpisodes());
  return (
    <div className="flex flex-col gap-16 pt-12 pb-24 sm:pt-16">
      <DraftRibbon
        uses={[
          shell,
          site.name,
          episodes,
          home.latestEpisode,
          episodePage,
          microcopy.comingSoon,
          feedSource,
        ]}
      />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 sm:px-6">
        <h1 className="font-display text-5xl leading-tight sm:text-6xl">
          {episodes.title}
        </h1>
        <p className="text-xl text-muted-foreground">{episodes.intro.text}</p>
      </div>
      <LatestEpisode
        episode={archive?.latest}
        copy={home.latestEpisode}
        comingSoon={microcopy.comingSoon}
        playerCopy={shell.player}
        mark={
          archive && (
            <FinishedMark
              guid={archive.latest.guid}
              label={episodes.finished}
            />
          )
        }
      />
      {archive && (
        <EpisodeArchive
          years={archive.years}
          copy={episodePage}
          finished={episodes.finished}
          playerCopy={shell.player}
        />
      )}
    </div>
  );
}
