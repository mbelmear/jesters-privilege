import type { Shell } from "@/lib/content";

// The frame around every page: header, mobile menu, and footer. Section names
// follow GLOSSARY.md; the player's failure and the footer's privacy note,
// rewritten in #124's wit pass, await the Jesters' approval.
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
    { href: "/speak-freely", label: "Speak Freely" },
  ],
  menu: { open: "Open menu", close: "Close menu", title: "Menu" },
  themeToggle: "Dark theme",
  player: {
    label: "Player",
    play: "Play",
    pause: "Pause",
    resume: "Resume",
    resumeFrom: "from",
    startOver: "Start over",
    dismiss: "Not now",
    loading: "Loading",
    skipBack: "Back 15 seconds",
    skipForward: "Forward 30 seconds",
    speed: "Playback speed",
    position: "Position",
    of: "of",
    elapsed: "Elapsed",
    remaining: "Remaining",
    expand: "Show player controls",
    collapse: "Hide player controls",
    close: "Close player",
    failed: {
      text: "The Episode stopped loading, which is no way to treat a punchline. Check your connection, then press Play to carry on from here.",
      draft: true,
    },
  },
  footer: {
    explore: "Explore",
    listen: "Listen",
    follow: "Follow",
    social: {
      instagram: "Instagram",
      linkedin: "LinkedIn",
      facebook: "Facebook",
      tiktok: "TikTok",
      x: "X",
    },
    contact: "Write to the Jesters",
    privacyNote: {
      text: "No cookies, no tracking, and no courtiers taking notes. We count visits with Cloudflare's privacy-first analytics, and anything you send through Speak Freely goes only to the Jesters' inbox.",
      draft: true,
    },
    // Crossway's own wording for digital works, quoted in docs/spec.md
    // (Content), so it's final rather than the Jesters' copy to approve.
    esvNotice: {
      text: "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. ESV Text Edition: 2025. The ESV text may not be quoted in any publication made available to the public by a Creative Commons license. The ESV may not be translated in whole or in part into any other language. Used by permission. All rights reserved.",
    },
  },
} as const satisfies Shell;
