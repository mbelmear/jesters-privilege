import type { Metadata } from "next";
import { useId, type ReactNode } from "react";
import { DraftRibbon } from "@/components/draft-ribbon";
import { FleuronRule } from "@/components/fleuron-rule";
import { JesterBio } from "@/components/jester-bio";
import { JesterPortrait } from "@/components/jester-portrait";
import { ListenButtons } from "@/components/listen-buttons";
import { content } from "@/content";
import type { Jester, Section } from "@/lib/content";

const { about } = content;

export const metadata: Metadata = {
  title: about.title,
  description: about.intro.text,
};

// About: why a jester, the three Jesters and their bios, what the show
// believes, Redeemer Church, and how to listen.
export default function About() {
  // Read as the page renders, so a test can swap in other content.
  const { jesters, listen, microcopy, shell, site } = content;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-16 px-4 pt-12 pb-24 sm:px-6 sm:pt-16">
      <DraftRibbon
        uses={[
          shell,
          site.name,
          about,
          // Their bios; the summaries are the home page's.
          jesters.map((jester) => jester.bio),
          site.listen,
          listen,
          microcopy.newToPodcasts,
        ]}
      />
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-5xl leading-tight sm:text-6xl">
          {about.title}
        </h1>
        <p className="text-xl text-muted-foreground">{about.intro.text}</p>
      </div>
      <ProseSection section={about.whyAJester} />
      <FleuronRule className="mx-auto w-full max-w-xs" />
      <JestersSection title={about.jestersTitle} jesters={jesters} />
      <FleuronRule className="mx-auto w-full max-w-xs" />
      <ProseSection section={about.whatWeBelieve} />
      <ProseSection section={about.church} />
      <ProseSection section={about.howToListen}>
        <ListenButtons
          links={site.listen}
          copy={listen}
          newToPodcasts={microcopy.newToPodcasts}
          headingLevel={3}
        />
      </ProseSection>
    </div>
  );
}

// The three Jesters with equal billing, each in an arched portrait with their
// full bio. On phones the bio runs beneath the portrait and name; from the sm
// breakpoint it sits beside them.
function JestersSection({
  title,
  jesters,
}: {
  title: string;
  jesters: readonly Jester[];
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-8">
      <h2 id={headingId} className="font-display text-4xl">
        {title}
      </h2>
      <ul className="flex flex-col gap-12">
        {jesters.map((jester) => (
          <li
            key={jester.id}
            className="grid grid-cols-[6rem_1fr] items-center gap-x-5 gap-y-4 sm:grid-cols-[11rem_1fr] sm:items-start sm:gap-x-8"
          >
            <JesterPortrait
              jester={jester}
              sizes="(width >= 40rem) 11rem, 6rem"
              className="sm:row-span-2"
            />
            <div className="flex flex-col gap-1.5">
              <h3 className="font-display text-3xl">{jester.name}</h3>
              <p className="font-ui text-sm font-semibold tracking-wider text-brand-ink uppercase">
                {jester.role}
              </p>
            </div>
            {jester.bio && (
              <div className="col-span-2 flex flex-col gap-4 text-lg sm:col-span-1 sm:col-start-2">
                <JesterBio paragraphs={jester.bio.paragraphs} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// A titled section of the page's copy, with anything that belongs to it, such
// as the Listen buttons, after its paragraphs.
function ProseSection({
  section,
  children,
}: {
  section: Section;
  children?: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId} className="font-display text-4xl">
        {section.title}
      </h2>
      {section.paragraphs.map((text) => (
        <p key={text} className="text-lg">
          {text}
        </p>
      ))}
      {children}
    </section>
  );
}
