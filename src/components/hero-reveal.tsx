"use client";

import { m } from "motion/react";
import { storyParagraphClass } from "@/components/hero-story";
import { MotionProvider } from "@/components/motion-provider";

/**
 * The jester story told a paragraph at a time: each rises into view, once,
 * as the visitor scrolls to it, at the processional pace MotionProvider
 * sets. With reduced motion, MotionProvider leaves only the fade.
 */
export function HeroReveal({ paragraphs }: { paragraphs: readonly string[] }) {
  return (
    <MotionProvider>
      {paragraphs.map((text, index) => (
        <m.p
          key={text}
          className={storyParagraphClass(index, paragraphs.length)}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
        >
          {text}
        </m.p>
      ))}
    </MotionProvider>
  );
}
