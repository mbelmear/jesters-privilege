import { cn } from "@/lib/utils";

// A brand mark's outline on a 24 x 24 grid, inline; or, for one too large to
// repeat in every page's HTML, the address of a symbol drawing it.
export type MarkSource = { path: string } | { href: string };

// Decorative, in the surrounding text colour: the link it sits in carries the
// brand's name.
export function Mark({
  source,
  className,
}: {
  source: MarkSource;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("size-5 fill-current", className)}
    >
      {"path" in source ? <path d={source.path} /> : <use href={source.href} />}
    </svg>
  );
}
