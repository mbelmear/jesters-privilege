import type { Metadata } from "next";
import { site } from "@/content/site";
import { motionCss, motionPresets } from "@/lib/motion";
import { themeScript } from "@/lib/theme";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: site.name,
  description: site.tagline,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
