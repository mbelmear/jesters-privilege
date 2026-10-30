"use client";

import { useEffect, useState } from "react";
import {
  HeroStory,
  STORY_HIDDEN,
  storyParagraphClass,
} from "@/components/hero-story";
import { cn } from "@/lib/utils";

type Props = { paragraphs: readonly string[] };

// Waiting for Motion; told by Motion; or shown outright, because Motion
// failed to load or the fallback showed the story first.
type Story =
  | { mode: "waiting" }
  | { mode: "motion"; Reveal: React.ComponentType<Props> }
  | { mode: "shown" };

const FALLBACK = "animate-story-fallback";

/**
 * The jester story told a paragraph at a time: each rises into view, once,
 * as the visitor scrolls to it (HeroRevealMotion).
 *
 * Motion is its own chunk, fetched once React is running, so it never counts
 * among the bytes before the page's first paint. Until it loads, each
 * paragraph waits hidden, with a fallback that shows it anyway: at once
 * without JavaScript, and after a moment if Motion is slow or never comes.
 * Once the fallback has shown the story, Motion never hides it again.
 */
export function HeroReveal({ paragraphs }: Props) {
  const [story, setStory] = useState<Story>({ mode: "waiting" });
  useEffect(() => {
    import("./hero-reveal-motion").then(
      (loaded) =>
        setStory((current) =>
          current.mode === "waiting"
            ? { mode: "motion", Reveal: loaded.default }
            : current
        ),
      (error: unknown) => {
        console.error("The jester story's Motion failed to load", error);
        setStory({ mode: "shown" });
      }
    );
  }, []);

  switch (story.mode) {
    case "waiting":
      return (
        <WaitingStory
          paragraphs={paragraphs}
          onShown={() => setStory({ mode: "shown" })}
        />
      );
    case "motion":
      return <story.Reveal paragraphs={paragraphs} />;
    case "shown":
      return <HeroStory paragraphs={paragraphs} />;
    default: {
      const unhandled: never = story;
      return unhandled;
    }
  }
}

// Each paragraph as Motion first draws it, hidden, until the fallback shows
// it (onShown).
function WaitingStory({
  paragraphs,
  onShown,
}: Props & { onShown: () => void }) {
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
          onAnimationEnd={onShown}
        >
          {text}
        </p>
      ))}
    </>
  );
}
