import type { Jester } from "@/lib/content";

// Equal billing, in the order the Jesters asked for. Bios are their own words,
// as given on #6; summaries are condensed from them for the home page. Michael
// has no headshot yet, so he shows the monogram shield.
export const jesters = [
  {
    id: "michael",
    name: "Michael Belmear",
    role: "Co-host",
    summary: {
      text: "A deacon and software engineer who argues with computers all week and with Dan on Sundays. At 24, he's the voice of the pews.",
      draft: true,
    },
    bio: {
      paragraphs: [
        [
          "Michael is a deacon and software engineer who spends his days arguing with computers and his Sundays arguing with Dan. At 24, he’s the youngest at the table and the voice of the pews, with all the confidence of a man who hasn’t been wrong long enough to notice. He co-hosted ",
          { em: "The Perfect Lens" },
          " in college, until both of his co-hosts moved away. He’s choosing not to take it personally. He also named this show after a 160-year-old painting of a sulking court jester, which tells you most of what you need to know about him.",
        ],
      ],
    },
  },
  {
    id: "dan",
    name: "Dan Collins",
    role: "Co-host",
    summary: {
      text: "A discipleship pastor and father of five who came back to Christ and has talked about him ever since. He counts mountain biking as a spiritual discipline.",
      draft: true,
    },
    bio: {
      paragraphs: [
        [
          "Dan is a discipleship pastor, a father of five, and a man who has been asked more than once to behave in staff meetings. When God called him back to Christ, he came back to the church and the Bible too, and he hasn't stopped talking about either since. He used to host ",
          { em: "Polemical" },
          " by himself, which is why he now has two people to interrupt him. When he's not preaching, he's mountain biking, which he insists counts as a spiritual discipline.",
        ],
      ],
    },
    photo: {
      src: "/jesters/dan-collins.jpg",
      width: 380,
      height: 380,
      alt: "Dan Collins smiling outdoors, with swept-back hair, a full graying beard, and a blue checked shirt",
    },
  },
  {
    id: "aaron",
    name: "Aaron Canen",
    role: "Producer & Co-host",
    summary: {
      text: "A pastor's kid from Glendive who makes the rest of us sound good. He produces the show, rules on every dispute, and cuts the jokes that didn't land.",
      draft: true,
    },
    bio: {
      paragraphs: [
        [
          "Aaron is the one who makes the rest of us sound good, which is harder than it looks. A pastor's kid from Glendive, Montana, he studied music technology at Montana State and has lived where art meets technology ever since. He produces the show, rules on every dispute, and is quietly the smartest guy in the room. He'd never say that, so we will. If a joke didn't make the episode, Aaron cut it. You're welcome.",
        ],
      ],
    },
    photo: {
      src: "/jesters/aaron-canen.jpg",
      width: 380,
      height: 380,
      alt: "Aaron Canen smiling outdoors, with glasses, a short beard, and a blue button-down shirt",
    },
  },
] as const satisfies readonly Jester[];
