import type { Episode } from "./feed";

// The Episodes archive, the hymnal index: the newest Episode featured on its
// own, then every other one under the year it was published.
export type Archive = {
  latest: Episode;
  years: ArchiveYear[];
};

export type ArchiveYear = {
  year: number;
  episodes: Episode[];
};

// From the Feed's Episodes, newest first; nothing before Episode 1 is
// published. A year is the feed's, in UTC, as the dates beside it are
// (format-episode.ts).
export function archiveOf(episodes: readonly Episode[]): Archive | undefined {
  const [latest, ...rest] = episodes;
  if (!latest) return undefined;
  const years: ArchiveYear[] = [];
  for (const episode of rest) {
    const year = episode.publishedAt.getUTCFullYear();
    const last = years.at(-1);
    if (last?.year === year) last.episodes.push(episode);
    else years.push({ year, episodes: [episode] });
  }
  return { latest, years };
}
