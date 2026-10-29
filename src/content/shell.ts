import type { Shell } from "@/lib/content";

// The frame around every page: header, mobile menu, and footer. Section names
// follow GLOSSARY.md; the footer's privacy note awaits the Jesters' words.
export const shell = {
  skipLink: "Skip to content",
  homeLink: "Jester's Privilege, home",
  navLabel: "Main",
  nav: [
    { href: "/episodes", label: "Episodes", onlyWithEpisodes: true },
    { href: "/gallery", label: "Fools' Gallery" },
    { href: "/about", label: "About" },
    { href: "/submit", label: "Submit" },
  ],
  menu: { open: "Open menu", close: "Close menu", title: "Menu" },
  themeToggle: "Dark theme",
  footer: {
    social: {
      instagram: "Instagram",
      facebook: "Facebook",
      tiktok: "TikTok",
      x: "X",
    },
    socialLabel: "Follow the show",
    contact: "Write to the Jesters",
    rss: "RSS feed",
    privacyNote: {
      text: "No cookies and no tracking. We count visits with Cloudflare's privacy-first analytics, and anything you send through Submit goes only to the Jesters' inbox.",
      draft: true,
    },
  },
} as const satisfies Shell;
