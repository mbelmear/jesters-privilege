"use client";

import type { EpisodePage, PlayerCopy } from "@/lib/content";
import type { PlayableEpisode } from "@/lib/feed";
import { PlayEpisodeButton } from "./play-episode-button";
import { ShareButton } from "./share-button";
import { useEpisodeVisit } from "./use-episode-visit";

type Props = {
  episode: PlayableEpisode;
  // Read after Play's label, "Play Episode 4".
  name: string;
  // What the share sheet names the link.
  title: string;
  // The Episode page's path.
  path: string;
  copy: EpisodePage;
  playerCopy: PlayerCopy;
};

/**
 * An Episode page's Play and Share. A Visit that arrives on a Moment link
 * finds the Episode in the player, paused at the moment: a browser won't play
 * audio before a tap.
 */
export function EpisodeActions({
  episode,
  name,
  title,
  path,
  copy,
  playerCopy,
}: Props) {
  const { arrival, share } = useEpisodeVisit(episode);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-3">
        <PlayEpisodeButton
          episode={episode}
          name={name}
          copy={playerCopy}
          playFrom={
            arrival === "moment" ? copy.moment.playFrom.text : undefined
          }
        />
        <ShareButton
          title={title}
          path={path}
          share={share}
          copy={copy.share}
          momentCopy={copy.moment}
        />
      </div>
      {arrival === "bad" && (
        <p className="font-ui text-sm text-muted-foreground">
          {copy.moment.bad.text}
        </p>
      )}
    </div>
  );
}
