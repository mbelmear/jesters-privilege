"use client";

import { lazy, Suspense, useSyncExternalStore } from "react";
import {
  HeroStory,
  STORY_HIDDEN,
  storyParagraphClass,
} from "@/components/hero-story";
import { cn } from "@/lib/utils";

type Props = { paragraphs: readonly string[] };

const FALLBACK = "animate-story-fallback";

// Motion is its own chunk, fetched once React is running, so it never
// counts among the bytes before the page's first paint. Should it fail to
// load, the story simply shows.
const HeroRevealMotion = lazy<React.ComponentType<Props>>(() =>
  import("./hero-reveal-motion").catch(() => ({ default: HeroStory }))
);

// False in the server's HTML and while hydrating, true once React runs.
const subscribe = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

/**
 * The jester story told a paragraph at a time: each rises into view, once,
 * as the visitor scrolls to it (HeroRevealMotion).
 *
 * Until Motion loads, each paragraph waits hidden, with a fallback that
 * shows it anyway: at once without JavaScript, and after a moment if Motion
 * is slow or the page's scripts fail.
 */
export function HeroReveal({ paragraphs }: Props) {
  const hydrated = useHydrated();
  const waiting = <WaitingStory paragraphs={paragraphs} />;
  if (!hydrated) return waiting;
  return (
    <Suspense fallback={waiting}>
      <HeroRevealMotion paragraphs={paragraphs} />
    </Suspense>
  );
}

function WaitingStory({ paragraphs }: Props) {
  return (
    <>
      <noscript>
        <style>{`.${FALLBACK} { animation-delay: 0s; }`}</style>
      </noscript>
      {paragraphs.map((text, index) => (
        <p
          key={text}
          className={cn(
            storyParagraphClass(index, paragraphs.length),
            FALLBACK
          )}
          style={{
            opacity: STORY_HIDDEN.opacity,
            transform: `translateY(${STORY_HIDDEN.y}px)`,
          }}
        >
          {text}
        </p>
      ))}
    </>
  );
}
