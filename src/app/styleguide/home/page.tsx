import type { Metadata } from "next";
import { HeroReveal } from "@/components/hero-reveal";
import { hero } from "@/content/hero";
import { site } from "@/content/site";
import { styleguide } from "@/content/styleguide";
import { HomePreview } from "./home-preview";

export const metadata: Metadata = {
  title: `${styleguide.home.title} · ${site.name}`,
  robots: { index: false, follow: false },
};

// The home page preview with the hero revealed paragraph by paragraph.
export default function HomePreviewReveal() {
  return (
    <HomePreview
      heroOption="reveal"
      story={<HeroReveal paragraphs={hero.paragraphs} />}
    />
  );
}
