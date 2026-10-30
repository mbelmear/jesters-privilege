import Link from "next/link";
import { useId } from "react";
import { JesterPortrait } from "@/components/jester-portrait";
import type { Home, Jester } from "@/lib/content";

type Props = {
  jesters: readonly Jester[];
  copy: Home["jesters"];
  aboutHref: string;
};

/**
 * The three Jesters with equal billing: each in an arched portrait with their
 * name, role, and two-line summary, and a link to their full bios on About.
 * Side by side from the md breakpoint; on phones, a portrait beside each.
 */
export function MeetTheJesters({ jesters, copy, aboutHref }: Props) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 sm:px-6"
    >
      <h2
        id={headingId}
        className="text-center font-display text-4xl sm:text-5xl"
      >
        {copy.title}
      </h2>
      <ul className="grid gap-8 md:grid-cols-3 md:gap-10">
        {jesters.map((jester) => (
          <li
            key={jester.id}
            className="grid grid-cols-[7rem_1fr] items-center gap-5 md:grid-cols-1 md:items-start md:gap-6 md:text-center"
          >
            <JesterPortrait jester={jester} className="md:mx-auto md:w-56" />
            <div className="flex flex-col gap-1.5">
              <h3 className="font-display text-2xl">{jester.name}</h3>
              <p className="font-ui text-sm font-semibold tracking-wider text-brand-ink uppercase">
                {jester.role}
              </p>
              {jester.summary && (
                <p className="mt-1 text-muted-foreground">
                  {jester.summary.text}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Link
        href={aboutHref}
        className="self-center font-ui font-semibold text-primary underline underline-offset-4 hover:decoration-2"
      >
        {copy.link}
      </Link>
    </section>
  );
}
