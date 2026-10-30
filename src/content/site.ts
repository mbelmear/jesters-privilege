import type { Site } from "@/lib/content";

// Each Listen and social link appears on the site as soon as it's filled in.
export const site = {
  name: "Jester's Privilege",
  tagline: "Theology in the Motley.",
  description: {
    text: "A weekly theology-and-humor podcast from three Jesters who serve the King.",
  },
  // The show's inbox: Email Routing forwards it to the Jesters, and Submit
  // emails land here (wrangler.jsonc pins the email binding to it too).
  contactEmail: "hello@jestersprivilegepodcast.com",
  listen: {},
  social: {},
} as const satisfies Site;
