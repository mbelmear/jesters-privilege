// How each paragraph of the jester story is set, shared by both hero
// options. The opening paragraph's first letter is illuminated: an orange
// capital ruled in teal, as a scribe would begin a page. The closing line is
// set as a decree in the display face.
const OPENING =
  "first-letter:float-left first-letter:mt-1.5 first-letter:mr-3 first-letter:border-2 first-letter:border-primary first-letter:px-2 first-letter:pt-2 first-letter:font-display first-letter:text-6xl first-letter:leading-none first-letter:text-brand-display sm:first-letter:text-7xl";
const CLOSING =
  "pt-4 text-center font-display text-3xl text-primary sm:text-4xl";

export function storyParagraphClass(index: number, count: number): string {
  if (index === 0) return OPENING;
  return index === count - 1 ? CLOSING : "";
}

// How a paragraph of the revealed story waits for its turn: faded out and
// lowered, to rise into view.
export const STORY_HIDDEN = { opacity: 0, y: 24 } as const;

/** The jester story, all of it simply there. */
export function HeroStory({ paragraphs }: { paragraphs: readonly string[] }) {
  return paragraphs.map((text, index) => (
    <p key={text} className={storyParagraphClass(index, paragraphs.length)}>
      {text}
    </p>
  ));
}
