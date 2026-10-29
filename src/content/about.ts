import type { About } from "@/lib/content";

export const about = {
  whyAJester: {
    title: "Why a jester?",
    paragraphs: [
      "In the courts of old, the jester was the one person who could tell the king the truth. Everyone else flattered; the fool joked, and inside the joke was a warning. While the court laughed, the king listened.",
      "Christ is our King, and he needs no jester. But his church is made of people like us, and people drift. Paul says we are \"fools for Christ's sake\" (1 Corinthians 4:10), so we've taken the title gladly: three servants in the motley, laughing at ourselves first and calling the church back to her King.",
    ],
    draft: true,
  },
  whatWeBelieve: {
    title: "What we believe",
    paragraphs: [
      "We believe the Bible is the Word of God, true in all it teaches and the final word on what the church believes and does. We believe in one God, Father, Son, and Holy Spirit, and that we are saved by grace alone, through faith alone, in Christ alone.",
      "We laugh at a lot on this show, but never at the gospel. The jokes are aimed at us and at the habits the church picks up along the way, so that the truth underneath can be heard more clearly.",
    ],
    draft: true,
  },
  church: {
    title: "Redeemer Church, Bozeman",
    paragraphs: [
      "All three of us serve at Redeemer Church in Bozeman, Montana, where the coffee is strong and the sermons are long. The show is ours, not the church's, but it grew out of conversations in the halls there.",
      "If you're ever in Bozeman on a Sunday, come and find us. We're easy to spot: we're the ones laughing.",
    ],
    draft: true,
  },
  howToListen: {
    title: "How to listen",
    paragraphs: [
      "New Episodes come out every week. Follow the show in your favorite podcast app, or press play on any Episode right here on the site.",
    ],
    draft: true,
  },
} as const satisfies About;
