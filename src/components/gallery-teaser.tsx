import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { PaintingBand } from "@/components/painting-band";
import type { Home, Painting } from "@/lib/content";

type Props = {
  painting: Painting;
  copy: Home["gallery"];
  galleryHref: string;
};

/**
 * A glimpse of the Fools' Gallery: a painting band under the Gallery's name,
 * a few lines on what's inside, and the way in.
 */
export function GalleryTeaser({ painting, copy, galleryHref }: Props) {
  return (
    <section aria-label={copy.title} className="flex flex-col gap-8">
      <PaintingBand painting={painting} title={copy.title} />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 sm:px-6">
        <p className="text-lg">{copy.intro.text}</p>
        <Link
          href={galleryHref}
          className="inline-flex items-center gap-2 self-start font-ui font-semibold text-primary underline underline-offset-4 hover:decoration-2"
        >
          {copy.link.text}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </section>
  );
}
