import { DraftRibbon } from "@/components/draft-ribbon";
import { ThemedLogo } from "@/components/themed-logo";
import { content } from "@/content";

export default function Home() {
  const { site, shell, hero } = content;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <DraftRibbon uses={[shell, site, hero]} />
      {/* The logo is the heading; the label names it once, as only one of
          its two images shows. */}
      <h1 aria-label={site.name} className="w-64 sm:w-80">
        <ThemedLogo
          logo={hero.logo}
          alt={shell.logo.alt}
          sizes="(width < 40rem) 256px, 320px"
          loading="largest-paint"
          className="h-auto w-full"
        />
      </h1>
      <p className="max-w-md text-lg">{site.description.text}</p>
    </div>
  );
}
