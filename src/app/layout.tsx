import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { content } from "@/content";
import { getEpisodes } from "@/content/feed";
import { motionCss, motionPresets } from "@/lib/motion";
import { themeScript } from "@/lib/theme";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: content.site.name,
  description: content.site.description.text,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { site, shell } = content;
  const episodes = await getEpisodes();
  return (
    // The theme script may set data-theme before React hydrates.
    <html
      lang="en"
      className={`${fontVariables} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <style dangerouslySetInnerHTML={{ __html: motionCss(motionPresets) }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-primary px-4 py-2 font-ui font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          {shell.skipLink}
        </a>
        <SiteHeader shell={shell} episodeCount={episodes.length} />
        {/* Content starts below the header at its full height. A page with
            a hero painting can pull it up under the transparent header. */}
        <main
          id="main"
          tabIndex={-1}
          className="flex flex-1 flex-col pt-(--header-height) outline-none"
        >
          {children}
        </main>
        <SiteFooter
          site={site}
          copy={shell.footer}
          year={new Date().getFullYear()}
        />
        {/* Reserved for the persistent player (#19). It lives here so audio
            survives client-side navigation, and sticks to the bottom of the
            viewport without ever covering the footer. */}
        <div id="player" className="sticky bottom-0 z-40" />
      </body>
    </html>
  );
}
