import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DraftRibbon } from "@/components/draft-ribbon";
import { EpisodeDetails } from "@/components/episode-details";
import { content } from "@/content";
import { feedSource, getEpisodes } from "@/content/feed";
import { episodeAddress, findEpisode } from "@/lib/feed";
import { episodeLabel } from "@/lib/format-episode";

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
  const label = episodeLabel(episode, content.episodePage);
  return {
    title: `${label.text}: ${episode.title}`,
    description: episode.excerpt,
  };
}

export default async function EpisodePage({
  params,
}: PageProps<"/episodes/[...address]">) {
  const sequence = await episodeAt((await params).address);
  const { shell, site, episodePage } = content;
  return (
    <>
      <DraftRibbon uses={[shell, site.name, episodePage, feedSource]} />
      <EpisodeDetails sequence={sequence} copy={episodePage} />
    </>
  );
}
