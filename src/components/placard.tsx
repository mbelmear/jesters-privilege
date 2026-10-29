import type { Painting } from "@/lib/content";

// The museum label beside a painting: artist, title and year, medium, and the
// collection that holds it. All of it is set in the UI face's one loaded
// weight, with the title upright, so a painting adds no font file to a page:
// an italic title would load the body italic, and a name such as Stańczyk its
// extended-Latin file too. Size, case, and color carry the hierarchy.
export function Placard({ placard }: { placard: Painting["placard"] }) {
  const { artist, title, year, medium, collection } = placard;
  return (
    <div className="flex flex-col gap-0.5 border-l-2 border-brand pl-3 font-ui text-sm leading-snug font-semibold">
      <p className="tracking-wider uppercase">{artist}</p>
      <p>
        <cite className="text-base not-italic">{title}</cite>, {year}
      </p>
      <p className="text-muted-foreground">{medium}</p>
      <p className="text-muted-foreground">{collection}</p>
    </div>
  );
}
