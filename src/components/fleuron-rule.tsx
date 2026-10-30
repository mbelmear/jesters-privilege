import { cn } from "@/lib/utils";

/**
 * A printer's flower between two hairlines, the way old books closed a
 * section. Decoration only, so assistive technology skips it.
 */
export function FleuronRule({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("flex items-center gap-4", className)}
    >
      <span className="h-px flex-1 bg-border" />
      <svg viewBox="0 0 48 24" className="h-5 w-10 fill-brand stroke-brand">
        {/* A hedera leaf on its side, with a curling stem. */}
        <path d="M30 12c0-6 5-10 12-10-1 5-3 8-6 10 3 2 5 5 6 10-7 0-12-4-12-10Z" />
        <path
          d="M30 12C24 12 20 7 14 7 9 7 6 10 6 13c0 3 2 5 5 5 2 0 4-2 4-4 0-2-1-3-3-3"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
