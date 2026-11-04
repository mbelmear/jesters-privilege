import { useId } from "react";
import { ListenIcon } from "@/components/listen-icon";
import { Button } from "@/components/ui/button";
import type { ListenCopy } from "@/lib/content";
import type { EpisodeListenLink } from "@/lib/episode-listen-links";

type Props = {
  // In the order they show, each opening the Episode in its app where the app
  // lists it, the show otherwise.
  links: readonly EpisodeListenLink[];
  copy: ListenCopy;
};

/**
 * "or listen on", then a small icon for each app the show is on, under an
 * Episode's Play button or player. Each icon's name is hidden text. Before the
 * show is on any app, nothing shows.
 */
export function EpisodeListenLinks({ links, copy }: Props) {
  const labelId = useId();
  if (links.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2">
      <p
        id={labelId}
        className="font-ui text-sm font-semibold text-muted-foreground"
      >
        {copy.onEpisode}
      </p>
      <ul aria-labelledby={labelId} className="flex flex-wrap">
        {links.map(({ app, href }) => (
          <li key={app}>
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="text-primary"
            >
              <a href={href}>
                <ListenIcon platform={app} />
                <span className="sr-only">{copy.platforms[app]}</span>
              </a>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
