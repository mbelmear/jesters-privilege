import type { Shell } from "@/lib/content";

// The frame around every page: header, mobile menu, and footer. Section names
// follow GLOSSARY.md; the footer's privacy note awaits the Jesters' words.
export const shell = {
  // Aaron's logo set (public/brand/), trimmed to the artwork.
  logo: {
    wordmark: {
      light: { src: "/brand/horizontal.png", width: 2971, height: 1189 },
      dark: { src: "/brand/horizontal-dark.png", width: 2971, height: 1189 },
    },
    icon: {
      light: { src: "/brand/icon.png", width: 2342, height: 2722 },
      dark: { src: "/brand/icon-dark.png", width: 2342, height: 2722 },
    },
    alt: "Jester's Privilege",
  },
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
