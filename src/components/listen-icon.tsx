import { siApplepodcasts, siRss, siSpotify, siYoutube } from "simple-icons";
import { amazonMusicMark } from "@/components/brand-marks";
import { Mark, type MarkSource } from "@/components/mark";
import type { ListenPlatform } from "@/lib/content";

// Platform marks from Simple Icons, or the brand's own where Simple Icons has
// none, drawn in the surrounding text color rather than each brand's.
export const LISTEN_MARKS: Record<ListenPlatform, MarkSource> = {
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
  return <Mark source={LISTEN_MARKS[platform]} className={className} />;
}
