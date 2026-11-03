import type { About } from "@/lib/content";

export const about = {
  title: "About",
  intro: {
    text: "Three Jesters from Redeemer Church in Bozeman, a weekly podcast about the church and her King, and why we wear the motley to make it.",
    draft: true,
  },
  whyAJester: {
    title: 'Why "Jester\'s Privilege"?',
    paragraphs: [
      "In the courts of medieval and Renaissance Europe, a king was surrounded by people who needed his favour. Courtiers praised his plans, laughed at his jokes and kept bad news to themselves, because one careless word could cost a man his place, or his head.",
      "The jester stood outside all of that. His motley, a patchwork of clashing colours, together with his belled cap and mock sceptre, told everyone at a glance that he held no rank, sought no office and was no rival to anyone. A man who could never rise had nothing to lose by speaking plainly, and no one could accuse him of scheming.",
      "That gave him a licence no one else at court enjoyed: he could mock the king to his face and say out loud what others only whispered. This freedom has come to be known as jester's privilege. The joke was the key to it. Truth told as a jest could be laughed off in public and taken to heart in private, so the king could hear it without losing face, and the jester could say it without losing his head. While the court laughed, the king listened.",
      "Christ is our King, and he needs no jester. He is never flattered and never wrong. But he has entrusted real authority to his church: he gave her the keys of the kingdom and sent her to speak in his name. Wherever there is authority, courtiers gather. The church has her own: celebrity pastors, passing fads and voices that tell her only what she wants to hear. She is dearly loved, yet she can wander, and when she does, those who lead in her name lead others astray with her.",
      "So we take up the jester's place. We seek no platform in the church and no office in it; we are simply three of her members, which is why we can say plainly what flatterers won't. Paul says we are \"fools for Christ's sake\" (1 Corinthians 4:10), and like the best fools of old, we speak because we love the one we serve, and we love his bride. So we laugh at ourselves first, speak the truth in love and call the church back to listen to her King.",
    ],
  },
  jestersTitle: "The Jesters",
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
