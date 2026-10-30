import fontGlyphs from "@/fonts/glyphs.json";
import {
  findText,
  validateContent,
  type Jester,
  type Paragraph,
} from "@/lib/content";
import { glyphsBeyondLatin } from "@/lib/fonts";
import { content } from ".";
import { styleguide } from "./styleguide";

describe("content", () => {
  it("passes validation", () => {
    expect(() => validateContent(content)).not.toThrow();
  });

  // A name such as Stańczyk sets its ń from the self-hosted subsets only if
  // `npm run fonts` has added it; otherwise the page also fetches the rest of
  // the typeface, up to 98 KB, before its first paint (#57).
  it("sets every letter in the self-hosted font subsets", () => {
    const used = glyphsBeyondLatin(findText({ content, styleguide }));
    const missing = [...used].filter(
      (glyph) => !fontGlyphs.beyondLatin.includes(glyph)
    );

    expect(missing).toEqual([]);
  });

  it("opens with the show intro, word for word", () => {
    expect(content.hero.paragraphs).toEqual([
      "Long ago, in the great halls of Europe, kings were surrounded by flattering courtiers too afraid to tell them the truth. But in every court, one man dared: the jester. With a jest, he showed the crown its folly, and while the court laughed, the king listened.",
      "The King of kings and Lord of lords needs no jester. But to his church, he gave the keys of the kingdom. She is dearly loved, yet she can wander, and she has courtiers of her own.",
      "Paul says we are fools for Christ. So, as servants of the true King, we've put on the motley to laugh at ourselves, speak the truth in love, and call the church to listen to her King.",
      "This is Jester's Privilege.",
    ]);
  });

  it("introduces the three Jesters in their words, in their order", () => {
    const jesters: readonly Jester[] = content.jesters;
    expect(
      jesters.map(({ name, role, bio }) => ({
        name,
        role,
        bio: bio?.paragraphs.map(plainText),
        draft: bio?.draft,
      }))
    ).toEqual([
      {
        name: "Michael Belmear",
        role: "Co-host",
        bio: [
          "Michael is a deacon and software engineer who spends his days arguing with computers and his Sundays arguing with Dan. At 24, he\u2019s the youngest at the table and the voice of the pews, with all the confidence of a man who hasn\u2019t been wrong long enough to notice. He co-hosted The Perfect Lens in college, until both of his co-hosts moved away. He\u2019s choosing not to take it personally. He also named this show after a 160-year-old painting of a sulking court jester, which tells you most of what you need to know about him.",
        ],
        draft: undefined,
      },
      {
        name: "Dan Collins",
        role: "Co-host",
        bio: [
          "Dan is a discipleship pastor, a father of five, and a man who has been asked more than once to behave in staff meetings. When God called him back to Christ, he came back to the church and the Bible too, and he hasn't stopped talking about either since. He used to host Polemical by himself, which is why he now has two people to interrupt him. When he's not preaching, he's mountain biking, which he insists counts as a spiritual discipline.",
        ],
        draft: undefined,
      },
      {
        name: "Aaron Canen",
        role: "Producer & Co-host",
        bio: [
          "Aaron is the one who makes the rest of us sound good, which is harder than it looks. A pastor's kid from Glendive, Montana, he studied music technology at Montana State and has lived where art meets technology ever since. He produces the show, rules on every dispute, and is quietly the smartest guy in the room. He'd never say that, so we will. If a joke didn't make the episode, Aaron cut it. You're welcome.",
        ],
        draft: undefined,
      },
    ]);
  });

  it.each([
    ["michael", "The Perfect Lens"],
    ["dan", "Polemical"],
  ])("sets the podcast title in %s's bio in italics", (id, title) => {
    const jester = content.jesters.find((jester) => jester.id === id);
    expect(jester?.bio?.paragraphs[0]).toContainEqual({ em: title });
  });

  it("has headshots of Dan and Aaron, and none yet of Michael", () => {
    const jesters: readonly Jester[] = content.jesters;
    expect(
      jesters.map(({ id, photo }) => [id, photo?.src, Boolean(photo?.alt)])
    ).toEqual([
      ["michael", undefined, false],
      ["dan", "/jesters/dan-collins.jpg", true],
      ["aaron", "/jesters/aaron-canen.jpg", true],
    ]);
  });

  it("gives each Jester a two-line summary, drafted until they approve one", () => {
    for (const { summary } of content.jesters) {
      expect(summary?.draft).toBe(true);
      expect(summary?.text.length).toBeLessThanOrEqual(160);
    }
  });
});

function plainText(paragraph: Paragraph): string {
  return paragraph
    .map((part) => (typeof part === "string" ? part : part.em))
    .join("");
}
