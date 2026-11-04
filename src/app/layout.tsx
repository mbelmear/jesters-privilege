import type { Metadata } from "next";
import { PlayerDock } from "@/components/player-dock";
import { PlayerProvider } from "@/components/player-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WebAnalytics } from "@/components/web-analytics";
import { content } from "@/content";
import { feedSource, getEpisodes } from "@/content/feed";
import { analyticsToken } from "@/lib/analytics";
import { feedUrl } from "@/lib/feed-source";
import { siteOpenGraph } from "@/lib/seo";
import { motionCss, motionPresets } from "@/lib/motion";
import { themeScript } from "@/lib/theme";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  // Makes canonical addresses and link-preview images absolute.
  metadataBase: new URL(content.site.url),
  title: {
    default: content.site.name,
    template: `%s | ${content.site.name}`,
  },
  description: content.site.description.text,
  // Pages set their own (src/lib/seo.ts); this covers any that don't, such
  // as the 404 page.
  openGraph: siteOpenGraph(content.site),
  // The tab icon follows the browser's color scheme, so it stays legible on
  // a dark tab bar. Browsers that ignore `media` fall back to /favicon.ico.
  // Declared here rather than as app/ icon files, which can't take `media`
  // and which this list would hide.
  icons: {
    icon: [
      {
        url: "/brand/favicon-light.png",
        type: "image/png",
        sizes: "96x96",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/brand/favicon-dark.png",
        type: "image/png",
        sizes: "96x96",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    // On parchment, as iOS fills transparency with black.
    apple: {
      url: "/brand/apple-icon.png",
      type: "image/png",
      sizes: "180x180",
    },
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { site, shell } = content;
  // Only the words the player shows, since its props ship on every page.
  const { episode, bonus, trailer } = content.episodePage;
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
        {/* Here rather than in metadata.alternates, which a page's canonical
          address would replace. */}
        <link
          rel="alternate"
          type="application/rss+xml"
          title={site.name}
          href={feedUrl(feedSource)}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <PlayerProvider showName={site.name}>
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
            shell={shell}
            platforms={content.listen.platforms}
            episodeCount={episodes.length}
            year={new Date().getFullYear()}
          />
          {/* The persistent player lives here so audio survives client-side
            navigation. It sticks to the bottom of the viewport, in the page's
            flow, so it never covers the footer. */}
          <div id="player" className="sticky bottom-0 z-40">
            <PlayerDock
              copy={shell.player}
              labels={{ episode, bonus, trailer }}
            />
          </div>
        </PlayerProvider>
        <WebAnalytics
          token={analyticsToken({
            SITE_ENV: process.env.SITE_ENV,
            WEB_ANALYTICS_TOKEN: process.env.WEB_ANALYTICS_TOKEN,
          })}
        />
      </body>
    </html>
  );
}
