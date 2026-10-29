import { validateContent } from "@/lib/content";
import { content } from ".";

describe("content", () => {
  it("passes validation", () => {
    expect(() => validateContent(content)).not.toThrow();
  });

  it("opens with the show intro, word for word", () => {
    expect(content.hero.paragraphs).toEqual([
      "Long ago, in the great halls of Europe, kings were surrounded by flattering courtiers too afraid to tell them the truth. But in every court, one man dared: the jester. With a jest, he showed the crown its folly, and while the court laughed, the king listened.",
      "The King of kings and Lord of lords needs no jester. But to his church, he gave the keys of the kingdom. She is dearly loved, yet she can wander, and she has courtiers of her own.",
      "Paul says we are fools for Christ. So, as servants of the true King, we've put on the motley to laugh at ourselves, speak the truth in love, and call the church to listen to her King.",
      "This is Jester's Privilege.",
    ]);
  });

  it("introduces the three Jesters, each with a draft bio until they write their own", () => {
    expect(
      content.jesters.map(({ name, role, bio }) => ({
        name,
        role,
        draft: bio?.draft,
      }))
    ).toEqual([
      { name: "Dan Collins", role: "Pastor", draft: true },
      { name: "Michael Belmear", role: "Deacon", draft: true },
      { name: "Aaron Canen", role: "Producer", draft: true },
    ]);
  });
});
