import type { Metadata } from "next";
import { DraftRibbon } from "@/components/draft-ribbon";
import { SubmitForm } from "@/components/submit-form";
import { content } from "@/content";
import { turnstileSiteKey } from "@/lib/turnstile";
import { pageMetadata } from "@/lib/seo";

const { speakFreely, shell, site } = content;

export const metadata: Metadata = pageMetadata(content.site, {
  path: "/speak-freely",
  title: speakFreely.title,
  description: speakFreely.intro.text,
});

// Read as the page is built: the static export bakes it into the HTML.
const siteKey = turnstileSiteKey({
  TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY,
});

// Speak Freely: where listeners send the Jesters a Question, Confession, Topic idea,
// or anything else.
export default function SpeakFreely() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 pt-12 pb-24 sm:px-6 sm:pt-16">
      <DraftRibbon uses={[shell, site.name, speakFreely]} />
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-5xl leading-tight sm:text-6xl">
          {speakFreely.title}
        </h1>
        <p className="text-xl text-muted-foreground">
          {speakFreely.intro.text}
        </p>
      </div>
      <SubmitForm copy={speakFreely} siteKey={siteKey} />
      <p className="border-t border-border pt-6 text-sm text-muted-foreground">
        {speakFreely.privacyNote.text}
      </p>
    </div>
  );
}
