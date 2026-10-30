"use client";

import { m } from "motion/react";
import { STORY_HIDDEN, storyParagraphClass } from "@/components/hero-story";
import { MotionProvider } from "@/components/motion-provider";

/**
 * The jester story with Motion: each paragraph rises into view, once, as the
 * visitor scrolls to it, at the processional pace MotionProvider sets. With
 * reduced motion, MotionProvider leaves only the fade. HeroReveal loads it.
 */
export default function HeroRevealMotion({
  paragraphs,
}: {
  paragraphs: readonly string[];
}) {
  return (
    <MotionProvider>
      {paragraphs.map((text, index) => (
        <m.p
          key={text}
          className={storyParagraphClass(index, paragraphs.length)}
          initial={STORY_HIDDEN}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
        >
          {text}
        </m.p>
      ))}
    </MotionProvider>
  );
}
