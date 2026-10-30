import Link from "next/link";
import { useId } from "react";
import { PlayEpisodeButton } from "@/components/play-episode-button";
import type { Copy, Home, PlayerCopy } from "@/lib/content";
import { episodePath, playableEpisode, type Episode } from "@/lib/feed";
import {
  episodeLabel,
  formatListeningTime,
  formatPublishDate,
} from "@/lib/format-episode";

type Props = {
  // The newest Episode, or none before Episode 1 is published.
  episode: Episode | undefined;
  copy: Home["latestEpisode"];
  comingSoon: Copy;
  playerCopy: PlayerCopy;
};

/**
 * The newest Episode, set like a hymn board: its number large in the display
 * face beside the title, date, length, and excerpt, with a button to play
 * it in the player. Bonus and trailer Episodes carry an orange label in place of a number.
 * Before any Episode is published, it says one is on its way.
 */
export function LatestEpisode({
  episode,
  copy,
  comingSoon,
  playerCopy,
}: Props) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 sm:px-6"
    >
      <h2
        id={headingId}
        className="font-ui text-sm font-semibold tracking-widest text-muted-foreground uppercase"
      >
        {copy.title}
      </h2>
      {episode ? (
        <EpisodeCard episode={episode} copy={copy} playerCopy={playerCopy} />
      ) : (
        <p className="border-l-2 border-brand py-2 pl-4 text-lg">
          {comingSoon.text}
        </p>
      )}
    </section>
  );
}

function EpisodeCard({
  episode,
  copy,
  playerCopy,
}: {
  episode: Episode;
  copy: Home["latestEpisode"];
  playerCopy: PlayerCopy;
}) {
  const href = episodePath(episode);
  const label = episodeLabel(episode, copy);
  return (
    <article className="grid gap-x-8 gap-y-4 border-t-4 border-frame bg-card p-6 shadow-md sm:grid-cols-[auto_1fr] sm:p-8">
      {label.kind === "labelled" ? (
        <p className="font-ui text-sm font-semibold tracking-widest text-brand-ink uppercase sm:pt-2">
          {label.text}
        </p>
      ) : (
        <p className="flex items-baseline gap-2 sm:flex-col sm:items-center sm:gap-0">
          <span className="font-ui text-sm font-semibold tracking-widest text-muted-foreground uppercase">
            {copy.episode}
          </span>{" "}
          <span className="font-display text-5xl leading-none text-brand-display sm:text-7xl">
            {label.number}
          </span>
        </p>
      )}
      <div className="flex flex-col gap-3">
        <h3 className="font-display text-3xl sm:text-4xl">
          <Link
            href={href}
            className="hover:underline hover:decoration-2 hover:underline-offset-4"
          >
            {episode.title}
          </Link>
        </h3>
        <p className="font-ui text-sm font-semibold text-muted-foreground">
          {formatPublishDate(episode.publishedAt)} ·{" "}
          {formatListeningTime(episode.durationSeconds, copy.units)}
        </p>
        <p className="line-clamp-3">{episode.excerpt}</p>
        <div className="mt-2">
          <PlayEpisodeButton
            episode={playableEpisode(episode)}
            name={label.kind === "labelled" ? episode.title : label.text}
            copy={playerCopy}
          />
        </div>
      </div>
    </article>
  );
}
