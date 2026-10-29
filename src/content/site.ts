import type { Site } from "@/lib/content";

// Each Listen and social link appears on the site as soon as it's filled in.
export const site = {
  name: "Jester's Privilege",
  tagline: "Theology in the Motley.",
  description: {
    text: "A weekly theology-and-humor podcast from three Jesters who serve the King.",
    draft: true,
  },
  contactEmail: "hello@jestersprivilegepodcast.com",
  listen: {},
  social: {},
} as const satisfies Site;
