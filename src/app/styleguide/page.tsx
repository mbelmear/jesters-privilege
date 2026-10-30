import type { Metadata } from "next";
import Link from "next/link";
import { DraftRibbon } from "@/components/draft-ribbon";
import { shell } from "@/content/shell";
import { site } from "@/content/site";
import { styleguide } from "@/content/styleguide";
import { Specimen } from "./specimen";

// An internal page for checking the design system, kept out of search.
export const metadata: Metadata = {
  title: `${styleguide.title} · ${site.name}`,
  robots: { index: false, follow: false },
};

export default function Styleguide() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6">
      <DraftRibbon uses={[shell, site, styleguide]} />
      {/* The page's theme follows the toggle in the site header. */}
      <div className="flex max-w-2xl flex-col gap-3">
        <h1 className="font-display text-5xl">{styleguide.title}</h1>
        <p className="text-lg text-muted-foreground">{styleguide.intro}</p>
        <Link
          href="/styleguide/paintings"
          className="font-ui font-semibold text-primary underline underline-offset-4"
        >
          {styleguide.paintingsLink}
        </Link>
        <Link
          href={styleguide.home.heroSwitch.options.reveal.href}
          className="font-ui font-semibold text-primary underline underline-offset-4"
        >
          {styleguide.homeLink}
        </Link>
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <Specimen scheme="light" copy={styleguide} />
        <Specimen scheme="dark" copy={styleguide} />
      </div>
    </div>
  );
}
