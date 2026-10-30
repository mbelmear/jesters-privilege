import type { Metadata } from "next";
import { DraftRibbon } from "@/components/draft-ribbon";
import { GalleryTimeline } from "@/components/gallery-timeline";
import { content } from "@/content";

const { gallery, shell, site } = content;

export const metadata: Metadata = {
  title: gallery.title,
  description: gallery.intro.text,
};

// The Fools' Gallery: the history of court jesters and holy fools, era by era.
export default function Gallery() {
  return (
    <div className="flex flex-col gap-16 pt-12 pb-24 sm:pt-16">
      <DraftRibbon uses={[shell, site.name, gallery]} />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 sm:px-6">
        <h1 className="font-display text-5xl leading-tight sm:text-6xl lg:text-7xl">
          {gallery.title}
        </h1>
        <p className="max-w-2xl text-xl text-muted-foreground">
          {gallery.intro.text}
        </p>
      </div>
      <GalleryTimeline gallery={gallery} />
    </div>
  );
}
