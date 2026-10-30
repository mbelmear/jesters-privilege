import { Play } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import type { Copy, Home } from "@/lib/content";
import { episodePath, type Episode } from "@/lib/feed";
import { formatListeningTime, formatPublishDate } from "@/lib/format-episode";

type Props = {
  // The newest Episode, or none before Episode 1 is published.
  episode: Episode | undefined;
  copy: Home["latestEpisode"];
  comingSoon: Copy;
};

/**
 * The newest Episode, set like a hymn board: its number large in the display
 * face beside the title, date, length, and excerpt, with a button to play
 * it. Bonus and trailer Episodes carry an orange label in place of a number.
 * Before any Episode is published, it says one is on its way.
 */
export function LatestEpisode({ episode, copy, comingSoon }: Props) {
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
        <EpisodeCard episode={episode} copy={copy} />
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
}: {
  episode: Episode;
  copy: Home["latestEpisode"];
}) {
  const href = episodePath(episode);
  const label = episodeLabel(episode, copy);
  return (
    <article className="grid gap-x-8 gap-y-4 border-t-4 border-frame bg-card p-6 shadow-md sm:grid-cols-[auto_1fr] sm:p-8">
      {label.number === undefined ? (
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
          {formatListeningTime(episode.durationSeconds)}
        </p>
        <p className="line-clamp-3">{episode.excerpt}</p>
        <Button asChild variant="brand" size="lg" className="mt-2 self-start">
          <Link href={href}>
            <Play aria-hidden="true" className="fill-current" />
            {copy.play}
            <span className="sr-only">
              {" "}
              {label.number === undefined ? episode.title : label.text}
            </span>
          </Link>
        </Button>
      </div>
    </article>
  );
}

// "Episode 4" for a full Episode; "Bonus" or "Trailer" for the rest.
function episodeLabel(
  episode: Episode,
  copy: Home["latestEpisode"]
): { text: string; number?: number } {
  switch (episode.type) {
    case "full":
      return {
        text: `${copy.episode} ${episode.number}`,
        number: episode.number,
      };
    case "bonus":
      return { text: copy.bonus };
    case "trailer":
      return { text: copy.trailer };
    default: {
      const unhandled: never = episode;
      return unhandled;
    }
  }
}
