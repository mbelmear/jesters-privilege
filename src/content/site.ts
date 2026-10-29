// Site-wide copy. The content model (#10) replaces this file's shape; until
// then, copy awaiting the Jesters' words is marked draft.

export const site = {
  name: "Jester's Privilege",
  tagline:
    "A weekly theology-and-humor podcast from three Jesters who serve the King.",
  // The show's inbox: Email Routing forwards it to the Jesters, and Submit
  // emails land here (wrangler.jsonc pins the email binding to it too).
  contactEmail: "hello@jestersprivilegepodcast.com",
  draft: true,
} as const;
