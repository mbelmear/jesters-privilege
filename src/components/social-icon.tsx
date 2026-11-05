import { siFacebook, siInstagram, siTiktok, siX } from "simple-icons";
import { linkedinMark } from "@/components/brand-marks";
import { Mark, type MarkSource } from "@/components/mark";
import type { SocialNetwork } from "@/lib/content";

// Network marks from Simple Icons, or the brand's own where Simple Icons has
// none, drawn in the surrounding text color rather than each brand's.
const ICONS: Record<SocialNetwork, MarkSource> = {
  instagram: siInstagram,
  linkedin: linkedinMark,
  facebook: siFacebook,
  tiktok: siTiktok,
  x: siX,
};

// Decorative: the link it sits in carries the network's name.
export function SocialIcon({
  network,
  className,
}: {
  network: SocialNetwork;
  className?: string;
}) {
  return <Mark source={ICONS[network]} className={className} />;
}
