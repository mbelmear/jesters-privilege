import type { Metadata } from "next";
import { ThemeToggle } from "@/components/theme-toggle";
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
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex max-w-2xl flex-col gap-3">
          <h1 className="font-display text-5xl">{styleguide.title}</h1>
          <p className="text-lg text-muted-foreground">{styleguide.intro}</p>
        </div>
        <ThemeToggle label={styleguide.themeToggleLabel} />
      </header>
      <div className="grid gap-8 lg:grid-cols-2">
        <Specimen scheme="light" copy={styleguide} />
        <Specimen scheme="dark" copy={styleguide} />
      </div>
    </main>
  );
}
