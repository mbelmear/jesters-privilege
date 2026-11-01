import { siApplepodcasts, siRss, siSpotify, siYoutube } from "simple-icons";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
  LISTEN_PLATFORMS,
  type Copy,
  type Home,
  type ListenPlatform,
  type Site,
} from "@/lib/content";

type Props = {
  links: Site["listen"];
  copy: Home["listen"];
  newToPodcasts: Copy;
  // The heading's level: a section of its own on the home page, a part of
  // "How to listen" on About.
  headingLevel?: 2 | 3;
};

// Platform marks from Simple Icons, drawn in the button's own color rather
// than each brand's.
const ICONS: Record<ListenPlatform, { path: string }> = {
  "apple-podcasts": siApplepodcasts,
  spotify: siSpotify,
  youtube: siYoutube,
  rss: siRss,
};

/**
 * "Listen on" buttons for every platform the show is on, each hidden until
 * its link exists, with a word for visitors new to podcasts. Before the show
 * is on any platform, nothing shows.
 */
export function ListenButtons({
  links,
  copy,
  newToPodcasts,
  headingLevel = 2,
}: Props) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const headingId = useId();
  const platforms = LISTEN_PLATFORMS.flatMap((platform) => {
    const href = links[platform];
    return href ? [{ platform, href }] : [];
  });
  if (platforms.length === 0) return null;
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col items-center gap-5 text-center"
    >
      <Heading
        id={headingId}
        className="font-ui text-sm font-semibold tracking-widest text-muted-foreground uppercase"
      >
        {copy.title}
      </Heading>
      <ul className="flex flex-wrap justify-center gap-3">
        {platforms.map(({ platform, href }) => (
          <li key={platform}>
            <Button asChild variant="outline" size="lg">
              <a href={href}>
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="size-5 fill-current"
                >
                  <path d={ICONS[platform].path} />
                </svg>
                {copy.platforms[platform]}
              </a>
            </Button>
          </li>
        ))}
      </ul>
      <p className="max-w-md text-sm text-muted-foreground">
        {newToPodcasts.text}
      </p>
    </section>
  );
}
