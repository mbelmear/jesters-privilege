import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DraftRibbon } from "@/components/draft-ribbon";
import { EpisodeDetails } from "@/components/episode-details";
import { JsonLd } from "@/components/json-ld";
import { content } from "@/content";
import {
  feedSource,
  getEpisodeListenLinks,
  getEpisodes,
  getTranscript,
} from "@/content/feed";
import { series } from "@/content/series";
import { episodeAddress, episodePath, findEpisode } from "@/lib/feed";
import { episodeTitle } from "@/lib/format-episode";
import { episodeCardPath, episodeJsonLd, pageMetadata } from "@/lib/seo";

// One page per Episode: /episodes/<number>, or /episodes/bonus/<slug> for one
// without a number (ADR 0002). Only the Feed's Episodes are built.
export const dynamicParams = false;

export async function generateStaticParams() {
  const episodes = await getEpisodes();
  // A static export refuses a route with no pages, so before Episode 1 is
  // published one address is built, and shows the 404 page (noindex).
  if (episodes.length === 0) return [{ address: ["coming-soon"] }];
  return episodes.map((episode) => ({ address: episodeAddress(episode) }));
}

async function episodeAt(address: string[]) {
  const sequence = findEpisode(await getEpisodes(), address);
  if (!sequence) notFound();
  return sequence;
}

export async function generateMetadata({
  params,
}: PageProps<"/episodes/[...address]">): Promise<Metadata> {
  const { episode } = await episodeAt((await params).address);
  const title = episodeTitle(episode, content.episodePage);
  return pageMetadata(content.site, {
    path: episodePath(episode),
    title,
    description: episode.excerpt,
    card: { path: episodeCardPath(episode), alt: title },
  });
}

export default async function EpisodePage({
  params,
}: PageProps<"/episodes/[...address]">) {
  const sequence = await episodeAt((await params).address);
  const transcript = await getTranscript(sequence.episode);
  const listenLinks = await getEpisodeListenLinks(sequence.episode);
  const { shell, site, episodePage, listen } = content;
  return (
    <>
      <DraftRibbon
        uses={[shell, site.name, site.listen, episodePage, listen, feedSource]}
      />
      <JsonLd data={episodeJsonLd(series, sequence.episode)} />
      <EpisodeDetails
        sequence={sequence}
        transcript={transcript}
        listenLinks={listenLinks}
        copy={episodePage}
        listenCopy={listen}
        playerCopy={shell.player}
      />
    </>
  );
}
