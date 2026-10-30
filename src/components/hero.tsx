import { ThemedLogo } from "@/components/themed-logo";
import type { Content } from "@/lib/content";

type Props = {
  logo: Content["hero"]["logo"];
  // The show's name, which the logo heading says.
  name: string;
  // The jester story: HeroStory, or HeroReveal to tell it a paragraph at a
  // time. A page imports only the one it shows, so a page with the simple
  // story ships no Motion.
  children: React.ReactNode;
};

/**
 * The home page's opening: the stacked logo with its tagline as the page's
 * heading, then the jester story beneath it in a reading column.
 */
export function Hero({ logo, name, children }: Props) {
  return (
    <section className="flex flex-col items-center gap-12 px-4 pt-8 pb-4 sm:px-6 sm:pt-12">
      {/* The logo is the heading; the label names it once, as only one of
          its two images shows. */}
      <h1 aria-label={name} className="w-64 sm:w-80">
        <ThemedLogo
          logo={logo}
          alt={name}
          sizes="(width < 40rem) 256px, 320px"
          loading="largest-paint"
          className="h-auto w-full"
        />
      </h1>
      <div className="flex w-full max-w-xl flex-col gap-6 text-lg leading-relaxed sm:text-xl">
        {children}
      </div>
    </section>
  );
}
