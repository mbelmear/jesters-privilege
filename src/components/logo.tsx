import Image from "next/image";
import { cn } from "@/lib/utils";
// A 300px-wide WebP of logo-draft.png, made with sharp, sized for the
// header: the full PNG is ten times the bytes.
import logo from "../../public/brand/logo-draft-header.webp";

// The draft logo has a baked-in white background, so it always sits on a
// parchment shield-cut plate. Multiplying the image onto the plate makes that
// white take the plate's color, leaving no box around the mark. Swap in the
// final transparent logo here once it arrives.
export function Logo({ alt, className }: { alt: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex bg-logo-plate px-2 pt-1 pb-2.5 [clip-path:polygon(0_0,100%_0,100%_72%,50%_100%,0_72%)]",
        className
      )}
    >
      <Image
        src={logo}
        alt={alt}
        unoptimized
        loading="eager"
        className="h-full w-auto mix-blend-multiply"
      />
    </span>
  );
}
