import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import fontGlyphs from "@/fonts/glyphs.json";
import {
  findDrafts,
  findText,
  validateContent,
  type Copy,
  type Fool,
  type Jester,
  type Paragraph,
  type Section,
} from "@/lib/content";
import { content } from ".";
import { contentGlyphsBeyondLatin } from "./glyphs";

describe("content", () => {
  it("passes validation", () => {
    expect(() => validateContent(content)).not.toThrow();
  });

  // The show's pages as the Jesters gave them (#6), without share-tracking
  // query strings.
  // The RSS feed stays in the page head only; the Jesters dropped its button.
  it("links to the show on Apple Podcasts, Spotify, Amazon Music, and YouTube", () => {
    expect(content.site.listen).toEqual({
      "apple-podcasts":
        "https://podcasts.apple.com/us/podcast/jesters-privilege/id6830338936",
      spotify: "https://open.spotify.com/show/6a7KnKe6ohzrMGZwJDc5Ti",
      "amazon-music":
        "https://music.amazon.com/podcasts/581f57eb-1503-4a04-b10d-5431bb5029b9/jesters-privilege",
      youtube: "https://www.youtube.com/@thejestersprivilegepodcast",
    });
  });

  it("links to the show's Instagram, LinkedIn, and TikTok", () => {
    expect(content.site.social).toEqual({
      instagram: "https://www.instagram.com/jestersprivilegepod/",
      linkedin: "https://www.linkedin.com/company/jester-s-privilege",
      tiktok: "https://www.tiktok.com/@jestersprivilegepod",
    });
  });

  // A name such as Stańczyk sets its ń from the self-hosted subsets only if
  // `npm run fonts` has added it; otherwise the page also fetches the rest of
  // the typeface, up to 98 KB, before its first paint (#57).
  it("sets every letter in the self-hosted font subsets", () => {
    const used = contentGlyphsBeyondLatin();
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

  it("has a described headshot of every Jester", () => {
    const jesters: readonly Jester[] = content.jesters;
    expect(
      jesters.map(({ id, photo }) => [id, photo?.src, Boolean(photo?.alt)])
    ).toEqual([
      ["michael", "/jesters/michael-belmear.jpg", true],
      ["dan", "/jesters/dan-collins.jpg", true],
      ["aaron", "/jesters/aaron-canen.jpg", true],
    ]);
  });

  // GLOSSARY.md's Avoid terms that are wrong wherever they appear. Terms that
  // depend on context, such as "Jester" for a historical figure, stay with
  // the reviewer. "Clown" reached Stańczyk's and Tarlton's stories and
  // Tarlton's alt text before #123.
  it.each(["clown"])("never calls anyone a %s (GLOSSARY.md)", (term) => {
    const word = new RegExp(`\\b${term}`, "i");
    expect(findText(content).filter((text) => word.test(text))).toEqual([]);
  });

  // The show is the Jesters' own, so no church is named in anything a
  // visitor reads (the elders' request on #6; docs/spec.md, About). The
  // fixture feed counts: previews show it. A Transcript may name the church
  // where a Jester says it, so transcripts/ is skipped.
  it("names no church", () => {
    const files = readdirSync(__dirname, { withFileTypes: true })
      .filter((entry) => entry.isFile() && !/\.test\.tsx?$/.test(entry.name))
      .map((entry) => entry.name);
    expect(
      files.filter((name) =>
        /Redeemer/i.test(readFileSync(join(__dirname, name), "utf8"))
      )
    ).toEqual([]);
  });

  // Michael's copy sign-off of 2026-11-03 (#116), word for word.
  it.each([
    [
      "the zero-Episodes message",
      content.microcopy.comingSoon,
      "Our Episodes have wandered off, which is awkward for a show about a church that wanders. We're out rounding them up. Check back soon.",
    ],
    [
      "the Episodes page intro",
      content.episodes.intro,
      "Every Episode, newest first. In each one, three fools for Christ laugh at the church's habits (ours first), then open the Scriptures to hear what the King actually said. Press Play on any of them, and it keeps playing while you wander the rest of the court.",
    ],
    [
      "the Transcript note",
      content.episodePage.transcript.machineNote,
      "A machine wrote this down while we talked. It's fast, it's free, and it has never once heard of Stańczyk. If it got something wrong, tell us on Speak Freely and we'll set it straight. Tap any timestamp to hear that moment.",
    ],
  ])("uses the approved %s", (_, copy: Copy, text) => {
    expect(copy).toEqual({ text });
  });

  it("uses the approved How to listen", () => {
    const { paragraphs, draft }: Section = content.about.howToListen;
    expect({ paragraphs, draft }).toEqual({
      paragraphs: [
        "We aim to release a new Episode every week. We're fools, not prophets, so if one runs late, forgive us. Follow the show in your podcast app and each new Episode arrives on its own, or press Play on any of them right here, free, no app required.",
      ],
      draft: undefined,
    });
  });

  // The rest of his story is the Gallery rewrite's (#123), still draft.
  it("closes Stańczyk's story with the approved line", () => {
    const fools: readonly Fool[] = content.gallery.fools;
    expect(fools.find((fool) => fool.slug === "stanczyk")?.story.coda).toBe(
      "It's Michael's favorite painting, and it helped name this show: a fool who sees the truth while the court dances on without him."
    );
  });

  // Michael is a deacon and Dan a discipleship pastor (#6).
  it("doesn't say the Jesters seek no office in the church", () => {
    expect(content.about.whyAJester.paragraphs.join(" ")).not.toMatch(
      /no office in it/
    );
  });

  // Scripture is quoted from the ESV (docs/spec.md, Content), so the site's
  // own copy has no King James English. A Fool's jests, setups included,
  // keep their sources' words ("hath", "quoth"), so they're skipped. Paul's story quoted the KJV
  // ("ye are wise in Christ") until #123, past a standard naming that mistake.
  it("quotes Scripture in modern English, not the KJV's", () => {
    const fools: readonly Fool[] = content.gallery.fools;
    const jests = new Set(
      fools
        .flatMap(({ story }) => story.jests ?? [])
        .flatMap(({ setup, line }) => [setup, line])
    );
    // Lowercase or capitalized, so a respelling's stressed THEE passes.
    const kjv =
      /\b([Yy]e|[Tt]hee|[Tt]hou|[Tt]hy|[Tt]hine|[Hh]ath|[Uu]nto|I am become)\b/;
    expect(
      findText(content).filter((text) => !jests.has(text) && kjv.test(text))
    ).toEqual([]);
  });

  // docs/spec.md, Pages: each era opens with "one short paragraph (about
  // 40–60 words) that sets the scene".
  it.each(content.gallery.eras.map((era) => [era.title, era.intro]))(
    "sets the scene for %s in one paragraph of 40 to 60 words",
    (_, intro) => {
      expect(intro.paragraphs).toHaveLength(1);
      const words = intro.paragraphs[0].split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(40);
      expect(words).toBeLessThanOrEqual(60);
    }
  );

  // The hard names and their respellings in the Fools research
  // (docs/research/fools-jests-and-pronunciations.md, Pronunciations), which
  // also lists the names that need none.
  it("respells every hard Fool name", () => {
    const fools: readonly Fool[] = content.gallery.fools;
    expect(fools.map(({ name, respelling }) => [name, respelling])).toEqual([
      ["Saint Paul", undefined],
      ["Francis of Assisi", "Francis of ah-SEE-see"],
      ["The yurodivy", "yoo-ROH-dih-vee"],
      ["Stańczyk", "STAHN-chik"],
      ["Triboulet", "tree-boo-LAY"],
      ["Will Somers", undefined],
      ["Erasmus", "ih-RAZ-mus"],
      ["Richard Tarlton", undefined],
      ["Archibald Armstrong", undefined],
      ["Pablo de Valladolid", "PAH-bloh deh bah-yah-doh-LEED"],
      ["Calabacillas", "kah-lah-bah-THEE-yahs"],
    ]);
  });

  // Approved in Michael's copy sign-off of 2026-11-03 (#116).
  it("gives each Jester an approved two-line summary", () => {
    const jesters: readonly Jester[] = content.jesters;
    for (const { summary } of jesters) {
      expect(summary?.draft).toBeUndefined();
      expect(summary?.text.length).toBeLessThanOrEqual(160);
    }
  });
});

// The wit pass on the working messages (#124): the rewritten ones await the
// Jesters' approval; the ones it left alone stay final.
describe("working messages", () => {
  it("marks the rewritten ones draft and leaves the rest final", () => {
    const { player, footer } = content.shell;
    const { problems, failed, sent, privacyNote } = content.speakFreely;
    const { share } = content.episodePage;

    expect({
      player: findDrafts(player.failed),
      footer: findDrafts(footer.privacyNote),
      share: findDrafts(share),
      problems: findDrafts(problems),
      failed: findDrafts(failed),
      sent: findDrafts(sent),
      privacyNote: findDrafts(privacyNote),
    }).toEqual({
      player: [""],
      footer: [""],
      share: ["copied", "failed"],
      problems: [
        "message-missing",
        "message-too-long",
        "name-invalid",
        "unverified",
      ],
      failed: ["delivery"],
      sent: ["text"],
      privacyNote: [],
    });
  });
});

function plainText(paragraph: Paragraph): string {
  return paragraph
    .map((part) => (typeof part === "string" ? part : part.em))
    .join("");
}

// Every microcopy entry is shown somewhere. Eight went unused once Speak
// Freely and the Episode page kept copies of their own, and four of them sat
// waiting for the Jesters' approval of text nobody sees (2026-11-03).
describe("microcopy", () => {
  const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return sources(path);
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
        ? [path]
        : [];
    });
  const code = sources(join(__dirname, ".."))
    .filter((path) => !path.endsWith(join("content", "microcopy.ts")))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  it.each(Object.keys(content.microcopy))("uses microcopy.%s", (key) => {
    expect(code).toMatch(new RegExp(`microcopy\\.${key}\\b`));
  });
});
