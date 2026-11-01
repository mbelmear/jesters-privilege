"use client";

import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import type { EpisodePage } from "@/lib/content";
import type { PlayableEpisode } from "@/lib/feed";
import { formatDuration } from "@/lib/format-duration";
import { currentParagraph, type Transcript } from "@/lib/transcript";
import { cn } from "@/lib/utils";
import {
  reportPlayerError,
  usePlayer,
  usePlayerState,
} from "./player-provider";

type Props = {
  episode: PlayableEpisode;
  transcript: Transcript;
  copy: EpisodePage["transcript"];
};

// How many paragraphs the collapsed Transcript shows, the last fading out.
const PREVIEW_PARAGRAPHS = 2;

/**
 * An Episode's Transcript, with each paragraph's timestamp in the margin like
 * a verse number. Tapping one plays the Episode from there, and the paragraph
 * being spoken is highlighted (never scrolled to: the reader may be elsewhere).
 * It opens collapsed to a faded preview; the paragraphs past it are in the
 * page's HTML all along, for search engines, but hidden until the reader
 * opens it in full.
 */
export function EpisodeTranscript({ episode, transcript, copy }: Props) {
  const player = usePlayer();
  const state = usePlayerState(player);
  const headingId = useId();
  const [expanded, setExpanded] = useState(false);
  const collapsed = !expanded && transcript.length > PREVIEW_PARAGRAPHS;
  // Where the reader carries on once the Transcript opens in full.
  const continuation = useRef<HTMLButtonElement>(null);
  // Only while this Episode is the one in the player.
  const current =
    state && state.mode !== "empty" && state.episode.guid === episode.guid
      ? currentParagraph(transcript, state.position)
      : null;

  function expand() {
    flushSync(() => setExpanded(true));
    continuation.current?.focus();
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2
        id={headingId}
        className="font-ui text-sm font-semibold tracking-widest text-muted-foreground uppercase"
      >
        {copy.title}
      </h2>
      <p className="text-base text-muted-foreground italic">
        {copy.machineNote.text}
      </p>
      <div
        className={cn("flex flex-col gap-1", collapsed && "mask-b-from-30%")}
      >
        {transcript.map(({ startSeconds, text }, i) => (
          <div
            key={startSeconds}
            data-paragraph
            hidden={collapsed && i >= PREVIEW_PARAGRAPHS}
            aria-current={i === current ? "true" : undefined}
            className="-mx-2 grid grid-cols-[3.5rem_1fr] gap-x-2 rounded-md px-2 py-2 motion-safe:transition-colors aria-[current=true]:bg-muted sm:grid-cols-[4rem_1fr]"
          >
            <button
              type="button"
              ref={i === PREVIEW_PARAGRAPHS ? continuation : undefined}
              onClick={() =>
                player
                  ?.play(episode, { at: startSeconds })
                  .catch(reportPlayerError)
              }
              className="-mt-0.5 min-h-6 self-start rounded-sm px-1 py-1 text-right font-ui text-xs font-semibold text-brand-ink tabular-nums hover:underline hover:underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="sr-only">{copy.playFrom} </span>
              {formatDuration(startSeconds)}
            </button>
            <p className="text-lg leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
      {collapsed && (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={expand}
        >
          {copy.expand}
        </Button>
      )}
    </section>
  );
}
