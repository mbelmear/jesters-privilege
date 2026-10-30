import { Picture } from "@/components/picture";
import type { ImageFile } from "@/lib/content";
import { cn } from "@/lib/utils";

// The draft logo has a baked-in white background, so it always sits on a
// parchment shield-cut plate. Multiplying the image onto the plate makes that
// white take the plate's color, leaving no box around the mark.
export function Logo({
  image,
  alt,
  className,
}: {
  image: ImageFile;
  alt: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex bg-logo-plate px-2 pt-1 pb-2.5 [clip-path:polygon(0_0,100%_0,100%_72%,50%_100%,0_72%)]",
        className
      )}
    >
      {/* About 120px wide in the header at its full height. */}
      <Picture
        image={image}
        alt={alt}
        sizes="120px"
        loading="eager"
        className="h-full w-auto mix-blend-multiply"
      />
    </span>
  );
}
