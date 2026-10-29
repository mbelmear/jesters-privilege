import type { Metadata } from "next";
import { DraftRibbon } from "@/components/draft-ribbon";
import { FramedPainting } from "@/components/framed-painting";
import { PaintingBand } from "@/components/painting-band";
import { shell } from "@/content/shell";
import { site } from "@/content/site";
import { styleguide } from "@/content/styleguide";

const copy = styleguide.paintings;

export const metadata: Metadata = {
  title: `${copy.title} · ${styleguide.title} · ${site.name}`,
  robots: { index: false, follow: false },
};

export default function StyleguidePaintings() {
  return (
    <div className="flex flex-col gap-12 pt-12 pb-16">
      <DraftRibbon uses={[shell, copy]} />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 sm:px-6">
        <h1 className="font-display text-5xl">{copy.title}</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">{copy.intro}</p>
      </div>
      <PaintingBand
        painting={copy.band.painting}
        title={copy.band.title}
        loading="eager"
      />
      <div className="mx-auto grid w-full max-w-7xl items-start gap-12 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
        {copy.framed.map((painting) => (
          <FramedPainting
            key={painting.src}
            painting={painting}
            sizes="(width >= 64rem) 22rem, (width >= 40rem) 40vw, 90vw"
          />
        ))}
      </div>
    </div>
  );
}
