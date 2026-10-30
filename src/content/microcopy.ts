import type { Copy } from "@/lib/content";

// Short copy used across the site. Which copy is final and which is draft:
// AGENTS.md, Content.
export const microcopy = {
  draftRibbon: { text: "Draft" },
  draftRibbonNote: {
    text: "Draft: this page uses copy awaiting the Jesters' words.",
  },
  comingSoon: {
    text: "Episode 1 is on its way. Follow the show and you'll hear it the moment it's published.",
    draft: true,
  },
  newToPodcasts: {
    text: "New to podcasts? Open the podcast app already on your phone (Apple Podcasts on an iPhone, Spotify or YouTube elsewhere), search for Jester's Privilege, and tap Follow. New Episodes will arrive on their own.",
    draft: true,
  },
  notFoundTitle: { text: "You've wandered from the court" },
  notFoundBody: {
    text: "This page isn't here. Perhaps a Fool hid it, or perhaps it never existed.",
    draft: true,
  },
  notFoundLink: { text: "Return to the court", draft: true },
  readFullTranscript: { text: "Read the full transcript" },
  transcriptNote: {
    text: "This Transcript is machine-generated, so forgive the odd spelling.",
    draft: true,
  },
  submitNameLabel: {
    text: "How should we say your name on the show? (Leave blank to stay anonymous.)",
  },
  submitEmailLabel: { text: "Only if you're OK with us following up." },
  submitConsentLabel: { text: "You can mention this on the show." },
  submitPrivacyNote: {
    text: "Your Submission goes straight to the Jesters' inbox and nowhere else. We don't store it on the site, and we'll only use your email to follow up.",
    draft: true,
  },
  submitSuccess: {
    text: "Received. The Jesters will read it, and you may hear it on the show.",
    draft: true,
  },
  submitFailure: {
    text: "Something went wrong and your Submission wasn't sent. Please try again in a moment, or email the show instead.",
    draft: true,
  },
} as const satisfies Record<string, Copy>;
