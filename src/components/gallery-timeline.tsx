import { FleuronRule } from "@/components/fleuron-rule";
import { FramedPainting } from "@/components/framed-painting";
import { PaintingBand } from "@/components/painting-band";
import type { Era, Fool, Gallery } from "@/lib/content";

type Props = { gallery: Gallery };

/**
 * The Fools' Gallery as a timeline: each era in turn, opening with its
 * painting band once one is sourced, then why this show wears the motley.
 * Within an era, a rail marked with the era's dates runs down beside its
 * introduction and its Fools.
 */
export function GalleryTimeline({ gallery }: Props) {
  const { eras, fools, closing } = gallery;
  return (
    <>
      {eras.map((era) => (
        <EraSection
          key={era.id}
          era={era}
          fools={fools.filter((fool) => fool.era === era.id)}
        />
      ))}
      <section
        aria-label={closing.title}
        className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 sm:px-6"
      >
        <FleuronRule />
        <h2 className="text-center font-display text-4xl text-balance sm:text-5xl">
          {closing.title}
        </h2>
        {closing.paragraphs.map((paragraph) => (
          <p key={paragraph} className="text-lg">
            {paragraph}
          </p>
        ))}
      </section>
    </>
  );
}

function EraSection({ era, fools }: { era: Era; fools: readonly Fool[] }) {
  const { title, period, intro, band } = era;
  return (
    <section aria-label={title} className="flex flex-col gap-10">
      {band ? (
        <PaintingBand painting={band} title={title} />
      ) : (
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <h2 className="border-b border-border pb-4 font-display text-4xl sm:text-5xl lg:text-6xl">
            {title}
          </h2>
        </div>
      )}
      <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-[9rem_minmax(0,1fr)] md:gap-10">
        <p className="font-ui text-sm font-semibold tracking-wider text-brand-ink uppercase md:sticky md:top-24 md:self-start md:text-right">
          {period}
        </p>
        <div className="relative flex flex-col gap-12 border-l-2 border-border pl-6 md:pl-10">
          {/* A lozenge, the heraldic diamond, marks where the era begins. */}
          <span
            aria-hidden="true"
            className="absolute top-1 -left-[7px] size-3 rotate-45 bg-brand"
          />
          <div className="flex max-w-2xl flex-col gap-4">
            <h3 className="font-display text-3xl">{intro.title}</h3>
            {intro.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-lg">
                {paragraph}
              </p>
            ))}
          </div>
          {fools.map((fool) => (
            <FoolEntry key={fool.slug} fool={fool} />
          ))}
        </div>
      </div>
    </section>
  );
}

// A Fool framed beside their story. The slug is the entry's id, so a link can
// point straight at them.
function FoolEntry({ fool }: { fool: Fool }) {
  const { slug, name, lived, story, painting } = fool;
  const heading = `${slug}-name`;
  return (
    <article
      id={slug}
      aria-labelledby={heading}
      className="grid scroll-mt-24 items-start gap-8 lg:grid-cols-2 lg:gap-12"
    >
      <div className="flex flex-col gap-4 lg:order-last">
        <div className="flex flex-col gap-1">
          <h3 id={heading} className="font-display text-4xl">
            {name}
          </h3>
          <p className="font-ui text-sm font-semibold tracking-wider text-muted-foreground uppercase">
            {lived}
          </p>
        </div>
        <p className="font-display text-2xl text-muted-foreground">
          {story.title}
        </p>
        {story.paragraphs.map((paragraph) => (
          <p key={paragraph} className="text-lg">
            {paragraph}
          </p>
        ))}
      </div>
      <FramedPainting
        painting={painting}
        sizes="(width >= 80rem) 33rem, (width >= 64rem) 40vw, (width >= 48rem) 70vw, 85vw"
      />
    </article>
  );
}
