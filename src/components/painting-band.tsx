import { Picture, type PictureLoading } from "@/components/picture";
import { Placard } from "@/components/placard";
import type { Painting } from "@/lib/content";

type Props = {
  painting: Painting;
  // A short title only: body text never sits on a painting.
  title: string;
  loading?: PictureLoading;
};

/**
 * A full-width painting between reading sections, with a short title over a
 * scrim and the placard beneath. Phones get a portrait crop cut around the
 * focal point; wider screens crop the whole painting to the band, keeping the
 * focal point in view. On desktops the painting slowly zooms, unless the
 * visitor prefers less motion.
 */
export function PaintingBand({ painting, title, loading }: Props) {
  const focus = `${painting.focalPoint.x * 100}% ${painting.focalPoint.y * 100}%`;
  return (
    <figure className="flex flex-col gap-3">
      <div className="relative aspect-4/5 overflow-hidden md:aspect-2/1 lg:aspect-5/2">
        <Picture
          image={painting}
          alt={painting.alt}
          sizes="100vw"
          loading={loading}
          phone={{ crop: "portrait", focalPoint: painting.focalPoint }}
          className="size-full object-cover lg:motion-safe:animate-band-zoom"
          style={{ objectPosition: focus, transformOrigin: focus }}
        />
        <div className="absolute inset-x-0 bottom-0 flex h-1/2 items-end bg-linear-to-t from-scrim to-transparent">
          <h2 className="mx-auto w-full max-w-7xl px-4 pb-6 font-display text-4xl text-on-scrim sm:px-6 sm:text-5xl lg:pb-10 lg:text-6xl">
            {title}
          </h2>
        </div>
      </div>
      <figcaption className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <Placard placard={painting.placard} />
      </figcaption>
    </figure>
  );
}
