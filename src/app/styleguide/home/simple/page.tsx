import type { Metadata } from "next";
import { HeroStory } from "@/components/hero";
import { hero } from "@/content/hero";
import { site } from "@/content/site";
import { styleguide } from "@/content/styleguide";
import { HomePreview } from "../home-preview";

export const metadata: Metadata = {
  title: `${styleguide.home.title} · ${site.name}`,
  robots: { index: false, follow: false },
};

// The home page preview with the hero simply there.
export default function HomePreviewSimple() {
  return (
    <HomePreview
      heroOption="simple"
      story={<HeroStory paragraphs={hero.paragraphs} />}
    />
  );
}
