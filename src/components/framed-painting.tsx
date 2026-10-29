import { Picture, type PictureLoading } from "@/components/picture";
import { Placard } from "@/components/placard";
import type { Painting } from "@/lib/content";
import { cn } from "@/lib/utils";

type Props = {
  painting: Painting;
  // How wide the frame shows; the default suits a reading column.
  sizes?: string;
  loading?: PictureLoading;
  className?: string;
};

/**
 * A painting shown whole, in a frame and mat like a gallery wall, with its
 * museum placard beneath. The caller sets its width.
 */
export function FramedPainting({
  painting,
  sizes = "(width >= 48rem) 28rem, 90vw",
  loading,
  className,
}: Props) {
  return (
    <figure className={cn("flex flex-col gap-4", className)}>
      <div className="border-8 border-frame bg-mat p-[5%] shadow-lg">
        <Picture
          image={painting}
          alt={painting.alt}
          sizes={sizes}
          loading={loading}
          className="block h-auto w-full"
        />
      </div>
      <figcaption>
        <Placard placard={painting.placard} />
      </figcaption>
    </figure>
  );
}
