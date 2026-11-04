import { useId } from "react";
import { ListenIcon } from "@/components/listen-icon";
import { Button } from "@/components/ui/button";
import {
  LISTEN_PLATFORMS,
  type Copy,
  type ListenCopy,
  type Site,
} from "@/lib/content";

type Props = {
  links: Site["listen"];
  copy: ListenCopy;
  newToPodcasts: Copy;
  // The heading's level: a section of its own on the home page, a part of
  // "How to listen" on About.
  headingLevel?: 2 | 3;
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
                <ListenIcon platform={platform} />
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
