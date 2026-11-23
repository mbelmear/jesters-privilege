import { useId } from "react";
import { ListenIcon } from "@/components/listen-icon";
import { Button } from "@/components/ui/button";
import { byName } from "@/lib/by-name";
import type { ListenCopy } from "@/lib/content";
import type { EpisodeListenLink } from "@/lib/episode-listen-links";

type Props = {
  // Each opening the Episode in its app where the app lists it, the show
  // otherwise. They show in alphabetical order, as in the footer.
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
  const named = links
    .map(({ app, href }) => ({ app, href, name: copy.platforms[app] }))
    .sort(byName);
  return (
    <div className="flex flex-wrap items-center gap-x-2">
      <p
        id={labelId}
        className="font-ui text-sm font-semibold text-muted-foreground"
      >
        {copy.onEpisode}
      </p>
      <ul aria-labelledby={labelId} className="flex flex-wrap">
        {named.map(({ app, href, name }) => (
          <li key={app}>
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="text-primary"
            >
              <a href={href}>
                <ListenIcon platform={app} />
                <span className="sr-only">{name}</span>
              </a>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
