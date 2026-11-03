import Link from "next/link";
import { useId } from "react";
import { FinishedMark } from "@/components/finished-mark";
import { PlayEpisodeButton } from "@/components/play-episode-button";
import type { ArchiveYear } from "@/lib/archive";
import type { EpisodePage, PlayerCopy } from "@/lib/content";
import { episodePath, type Episode } from "@/lib/feed";
import {
  episodeLabel,
  formatListeningTime,
  formatPublishDate,
  publishDateAttribute,
} from "@/lib/format-episode";
import { playableEpisode } from "@/lib/player";

type Props = {
  years: readonly ArchiveYear[];
  // The Episode labels and length units, shared with the Episode page.
  copy: EpisodePage;
  finished: string;
  playerCopy: PlayerCopy;
};

/**
 * The hymnal index: each year's Episodes under its heading, every row led by
 * its number large in the display face, as a hymn board shows them. Bonus and
 * trailer Episodes carry an orange label in place of a number.
 */
export function EpisodeArchive({ years, copy, finished, playerCopy }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-4 sm:px-6">
      {years.map(({ year, episodes }) => (
        <YearSection
          key={year}
          year={year}
          episodes={episodes}
          copy={copy}
          finished={finished}
          playerCopy={playerCopy}
        />
      ))}
    </div>
  );
}

function YearSection({
  year,
  episodes,
  ...rest
}: { year: number; episodes: readonly Episode[] } & Omit<Props, "years">) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="font-display text-3xl sm:text-4xl">
        {year}
      </h2>
      <ol>
        {episodes.map((episode) => (
          <EpisodeRow key={episode.guid} episode={episode} {...rest} />
        ))}
      </ol>
    </section>
  );
}

function EpisodeRow({
  episode,
  copy,
  finished,
  playerCopy,
}: { episode: Episode } & Omit<Props, "years">) {
  const label = episodeLabel(episode, copy);
  return (
    <li className="grid grid-cols-[3.5rem_1fr] gap-x-5 border-t pt-6 pb-6 sm:grid-cols-[4rem_1fr]">
      {label.kind === "labelled" ? (
        <p className="pt-2 font-ui text-xs font-semibold tracking-widest text-brand-ink uppercase">
          {label.text}
        </p>
      ) : (
        <p className="font-display text-4xl leading-none text-brand-display tabular-nums sm:text-5xl">
          <span className="sr-only">{copy.episode} </span>
          {label.number}
        </p>
      )}
      <div className="flex min-w-0 flex-col gap-2">
        <h3 className="font-display text-2xl">
          <Link
            href={episodePath(episode)}
            className="hover:underline hover:decoration-2 hover:underline-offset-4"
          >
            {episode.title}
          </Link>
        </h3>
        <p className="flex flex-wrap gap-x-2 font-ui text-sm font-semibold text-muted-foreground">
          <time dateTime={publishDateAttribute(episode.publishedAt)}>
            {formatPublishDate(episode.publishedAt)}
          </time>
          <span aria-hidden="true">·</span>
          <span>
            {formatListeningTime(episode.durationSeconds, copy.units)}
          </span>
          <FinishedMark guid={episode.guid} label={finished} />
        </p>
        {/* Two lines, set inline: a two-line clamp class would join the
            stylesheet every page loads (CODING_STANDARDS.md, Performance). */}
        <p className="line-clamp-3" style={{ WebkitLineClamp: 2 }}>
          {episode.excerpt}
        </p>
        <div className="mt-2">
          <PlayEpisodeButton
            episode={playableEpisode(episode)}
            name={label.kind === "labelled" ? episode.title : label.text}
            copy={playerCopy}
          />
        </div>
      </div>
    </li>
  );
}
