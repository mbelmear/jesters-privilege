import { Picture } from "@/components/picture";
import type { Jester } from "@/lib/content";
import { cn } from "@/lib/utils";

type Props = {
  jester: Jester;
  // How wide the portrait shows, as the `sizes` attribute.
  sizes?: string;
  className?: string;
};

/**
 * A Jester's headshot in an arched frame, like a cathedral window. Until a
 * Jester's photo arrives, the arch holds the monogram shield: a teal shield
 * bearing their initial in orange. The caller sets the width; the name and
 * role sit beside it, so the shield itself is decoration.
 */
export function JesterPortrait({
  jester,
  sizes = "(width >= 48rem) 14rem, 7rem",
  className,
}: Props) {
  return (
    <div
      className={cn(
        "rounded-t-full border-4 border-frame bg-mat p-1 shadow-md",
        className
      )}
    >
      <div className="relative aspect-4/5 overflow-hidden rounded-t-full bg-muted">
        {jester.photo ? (
          <Picture
            image={jester.photo}
            alt={jester.photo.alt}
            sizes={sizes}
            className="size-full object-cover"
          />
        ) : (
          <MonogramShield initial={jester.name.charAt(0)} />
        )}
      </div>
    </div>
  );
}

function MonogramShield({ initial }: { initial: string }) {
  return (
    <svg
      viewBox="0 0 100 120"
      aria-hidden="true"
      className="absolute inset-x-[18%] top-[22%] w-[64%]"
    >
      {/* A heater shield: flat top, sides curving to a point. */}
      <path
        d="M6 6h88v44c0 34-20 55-44 66C26 105 6 84 6 50Z"
        className="fill-frame stroke-brand"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <text
        x="50"
        y="54"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-brand font-display text-[64px]"
      >
        {initial}
      </text>
    </svg>
  );
}
