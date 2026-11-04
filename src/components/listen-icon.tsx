import { siApplepodcasts, siRss, siSpotify, siYoutube } from "simple-icons";
import { amazonMusicMark } from "@/components/brand-marks";
import type { ListenPlatform } from "@/lib/content";
import { cn } from "@/lib/utils";

// Platform marks from Simple Icons, or the brand's own where Simple Icons has
// none, drawn in the surrounding text color rather than each brand's.
const ICONS: Record<ListenPlatform, MarkSource> = {
  "apple-podcasts": siApplepodcasts,
  spotify: siSpotify,
  "amazon-music": amazonMusicMark,
  youtube: siYoutube,
  rss: siRss,
};

// Decorative: the link it sits in carries the platform's name.
export function ListenIcon({
  platform,
  className,
}: {
  platform: ListenPlatform;
  className?: string;
}) {
  return <Mark source={ICONS[platform]} className={className} />;
}

// A mark's outline on a 24 x 24 grid, inline; or, for one too large to repeat
// in every page's HTML, the address of a symbol drawing it.
export type MarkSource = { path: string } | { href: string };

export function Mark({
  source,
  className,
}: {
  source: MarkSource;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("size-5 fill-current", className)}
    >
      {"path" in source ? <path d={source.path} /> : <use href={source.href} />}
    </svg>
  );
}
