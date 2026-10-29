import type { Jester } from "@/lib/content";

// Equal billing: the order here is the order on the page, and no Jester is
// "host". Bios are condensed to two lines from docs/inputs/jesters.md.
export const jesters = [
  {
    id: "dan",
    name: "Dan Collins",
    role: "Pastor",
    bio: {
      text: "Dan is Redeemer's Discipleship Pastor, called back to Christ and straight into the Word. Husband to Annie, father of five, and happiest on a mountain bike.",
      draft: true,
    },
  },
  {
    id: "michael",
    name: "Michael Belmear",
    role: "Deacon",
    // Michael's source bio hasn't arrived; only his church title is real.
    bio: {
      text: "Michael serves Redeemer as its Deacon of Hospitality, setting the table so nobody in Bozeman eats alone. On the show, he's the one most likely to ask what everyone else was thinking.",
      draft: true,
    },
  },
  {
    id: "aaron",
    name: "Aaron Canen",
    role: "Producer",
    bio: {
      text: "Aaron is a pastor's kid from Glendive and Redeemer's Technical and Communications Director, where art meets technology. Husband to Mara, father of three, and the reason this show sounds like anything at all.",
      draft: true,
    },
  },
] as const satisfies readonly Jester[];
