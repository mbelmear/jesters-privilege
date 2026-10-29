import type { Era, Fool, Gallery } from "@/lib/content";

// The Fools' Gallery timeline. Each era gets its painting band, and each Fool
// their entry, once a public-domain painting is sourced (#13, #24, #25).
const eras = [
  {
    id: "holy-fools",
    title: "Holy Fools",
    period: "1st–16th centuries",
    intro: {
      title: "Fools for Christ",
      paragraphs: [
        'Before there were jesters in castles, there were fools in the church. Paul wrote to the proud Corinthians, "We are fools for Christ\'s sake," and meant it as a boast: the gospel looked like nonsense to the wise, and the apostles were content to look foolish carrying it.',
        "Francis of Assisi called his friars the jongleurs de Dieu, God's own minstrels and tumblers. In Russia, the yurodivy wandered barefoot through the snow and rebuked tsars to their faces, protected by a reputation for madness that let them say what no courtier dared.",
      ],
      draft: true,
    },
  },
  {
    id: "medieval-court",
    title: "The Medieval Court",
    period: "1100–1450",
    intro: {
      title: "The licensed fool",
      paragraphs: [
        "In the great households of medieval Europe, the fool held a strange office. He wore the motley and the cap with its bells, he ate at the lord's table, and he alone could mock the lord without losing his head.",
        "Some fools were simple, kept for the laughter they couldn't help. Others were sharp as knives, and their jokes carried warnings a wise king would heed and a foolish one would not.",
      ],
      draft: true,
    },
  },
  {
    id: "renaissance",
    title: "The Renaissance",
    period: "1450–1600",
    intro: {
      title: "Truth in a jest",
      paragraphs: [
        "The Renaissance was the jester's golden age. Stańczyk brooded at the Polish court while others danced, Triboulet traded barbs with the kings of France, and Will Somers could cheer Henry VIII when no one else could.",
        "In 1511 Erasmus published In Praise of Folly, putting a sermon on the vanity of the powerful into Folly's own mouth. Holbein filled the margins of a copy with drawings, and the fool became a voice for reform.",
      ],
      draft: true,
    },
  },
  {
    id: "reformation",
    title: "The Reformation",
    period: "1517–1650",
    intro: {
      title: "The last of the court fools",
      paragraphs: [
        "As Europe argued over the gospel, the fools argued too. Richard Tarlton made Elizabeth I laugh until she ordered him from the room, and Archibald Armstrong mocked Archbishop Laud so openly that he lost his place at court.",
        "In Spain, Velázquez painted the court fools of Philip IV with a dignity their masters rarely gave them. Within a generation the office was gone, but the fool's privilege of telling the truth with a smile was not.",
      ],
      draft: true,
    },
  },
] as const satisfies readonly Era[];

const fools = [] as const satisfies readonly Fool[];

export const gallery = {
  eras,
  fools,
  closing: {
    title: "Why this show wears the motley",
    paragraphs: [
      "The fools in this gallery served earthly kings, and the best of them loved their kings enough to tell them the truth. We serve a better King, one who needs no jester, but who has given his church a voice and asked her to use it.",
      "So we put on the motley. We laugh at church culture, at its fads and its celebrities and its strange habits, and we laugh at ourselves first. Then we open the Scriptures, because the point of the jest was always that the king would listen.",
    ],
    draft: true,
  },
} as const satisfies Gallery;
