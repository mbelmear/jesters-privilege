import { siApplepodcasts, siRss, siSpotify, siYoutube } from "simple-icons";
import type { ListenPlatform } from "@/lib/content";
import { cn } from "@/lib/utils";

// Platform marks from Simple Icons, drawn in the surrounding text color rather
// than each brand's.
const ICONS: Record<ListenPlatform, { path: string }> = {
  "apple-podcasts": siApplepodcasts,
  spotify: siSpotify,
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
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("size-5 fill-current", className)}
    >
      <path d={ICONS[platform].path} />
    </svg>
  );
}
