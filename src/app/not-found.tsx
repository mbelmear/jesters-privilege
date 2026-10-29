import type { Metadata } from "next";
import Link from "next/link";
import { DraftRibbon } from "@/components/draft-ribbon";
import { Button } from "@/components/ui/button";
import { content } from "@/content";

const { microcopy, site } = content;

// Served for every unknown address (out/404.html in the static export).
export const metadata: Metadata = {
  title: `${microcopy.notFoundTitle.text} · ${site.name}`,
};

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <DraftRibbon
        uses={[
          site,
          microcopy.notFoundTitle,
          microcopy.notFoundBody,
          microcopy.notFoundLink,
        ]}
      />
      <h1 className="max-w-2xl font-display text-5xl leading-tight text-balance sm:text-6xl">
        {microcopy.notFoundTitle.text}
      </h1>
      <p className="max-w-md text-lg text-muted-foreground">
        {microcopy.notFoundBody.text}
      </p>
      <Button asChild>
        <Link href="/">{microcopy.notFoundLink.text}</Link>
      </Button>
    </div>
  );
}
