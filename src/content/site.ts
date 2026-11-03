import type { Site } from "@/lib/content";

// Typed as the record, not its literal values, so a test can swap in other
// links with jest.replaceProperty.
const listen: Site["listen"] = {
  "apple-podcasts":
    "https://podcasts.apple.com/us/podcast/jesters-privilege/id6830338936",
  spotify: "https://open.spotify.com/show/6a7KnKe6ohzrMGZwJDc5Ti",
};

// Each Listen and social link appears on the site as soon as it's filled in.
export const site = {
  name: "Jester's Privilege",
  url: "https://jestersprivilegepodcast.com",
  tagline: "Theology in the Motley.",
  description: {
    text: "A weekly theology-and-humor podcast from three Jesters who serve the King.",
  },
  // The show's inbox: Email Routing forwards it to the Jesters, and Submission
  // emails land here (wrangler.jsonc pins the email binding to it too).
  contactEmail: "hello@jestersprivilegepodcast.com",
  listen,
  social: {},
} as const satisfies Site;
