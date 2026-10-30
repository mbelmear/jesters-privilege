import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { FleuronRule } from "@/components/fleuron-rule";
import { PlayEpisodeButton } from "@/components/play-episode-button";
import { ShareButton } from "@/components/share-button";
import type { EpisodePage, PlayerCopy } from "@/lib/content";
import { episodePath, type Episode, type EpisodeInSequence } from "@/lib/feed";
import {
  episodeLabel,
  episodeTitle,
  formatListeningTime,
  formatPublishDate,
  publishDateAttribute,
} from "@/lib/format-episode";
import { playableEpisode } from "@/lib/player";
import { cn } from "@/lib/utils";

type Props = {
  sequence: EpisodeInSequence;
  copy: EpisodePage;
  playerCopy: PlayerCopy;
};

/**
 * One Episode's page: its number (or bonus label), title, date, and length,
 * with Play and Share; then its Show notes; then the Episodes published just
 * before and after it.
 */
export function EpisodeDetails({ sequence, copy, playerCopy }: Props) {
  const { episode, previous, next } = sequence;
  const label = episodeLabel(episode, copy);
  const notesId = useId();
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-4">
        {label.kind === "labelled" ? (
          <p className="font-ui text-sm font-semibold tracking-widest text-brand-ink uppercase">
            {label.text}
          </p>
        ) : (
          <p className="flex items-baseline gap-3">
            <span className="font-ui text-sm font-semibold tracking-widest text-muted-foreground uppercase">
              {copy.episode}
            </span>{" "}
            <span className="font-display text-6xl leading-none text-brand-display sm:text-7xl">
              {label.number}
            </span>
          </p>
        )}
        <h1 className="font-display text-4xl leading-tight text-balance sm:text-5xl">
          {episode.title}
        </h1>
        <p className="font-ui text-sm font-semibold text-muted-foreground">
          <time dateTime={publishDateAttribute(episode.publishedAt)}>
            {formatPublishDate(episode.publishedAt)}
          </time>{" "}
          ·{" "}
          <span>
            {formatListeningTime(episode.durationSeconds, copy.units)}
          </span>
        </p>
        <div className="mt-2 flex flex-wrap items-start gap-3">
          <PlayEpisodeButton
            episode={playableEpisode(episode)}
            name={label.kind === "labelled" ? episode.title : label.text}
            copy={playerCopy}
          />
          <ShareButton
            title={episodeTitle(episode, copy)}
            path={episodePath(episode)}
            copy={copy.share}
          />
        </div>
      </header>

      <FleuronRule />

      <section aria-labelledby={notesId} className="flex flex-col gap-4">
        <h2
          id={notesId}
          className="font-ui text-sm font-semibold tracking-widest text-muted-foreground uppercase"
        >
          {copy.showNotes}
        </h2>
        {/* Sanitized to simple formatting by the Feed module. */}
        <div
          className="text-lg [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-3 [&_a:hover]:decoration-2 [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>ol]:my-4 [&>p]:my-4 [&>ul]:my-4"
          dangerouslySetInnerHTML={{ __html: episode.showNotesHtml }}
        />
      </section>

      <nav
        aria-label={copy.sequence.label}
        className="grid gap-4 border-t pt-8 sm:grid-cols-2"
      >
        {previous && (
          <SequenceLink
            episode={previous}
            direction="previous"
            label={copy.sequence.previous}
          />
        )}
        {next && (
          <SequenceLink
            episode={next}
            direction="next"
            label={copy.sequence.next}
          />
        )}
      </nav>
    </article>
  );
}

function SequenceLink({
  episode,
  direction,
  label,
}: {
  episode: Episode;
  direction: "previous" | "next";
  label: string;
}) {
  return (
    <Link
      href={episodePath(episode)}
      rel={direction === "previous" ? "prev" : "next"}
      className={cn(
        "group -mx-3 flex flex-col gap-1 rounded-md p-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        // Next sits on the right even when there's no previous.
        direction === "next" && "sm:col-start-2 sm:items-end sm:text-right"
      )}
    >
      <span className="flex items-center gap-2 font-ui [&_svg]:size-4 text-sm font-semibold tracking-widest text-muted-foreground uppercase">
        {direction === "previous" && <ArrowLeft aria-hidden="true" />}
        {label}
        {direction === "next" && <ArrowRight aria-hidden="true" />}
      </span>{" "}
      <span className="font-display text-xl text-primary group-hover:underline group-hover:underline-offset-4">
        {episode.title}
      </span>
    </Link>
  );
}
