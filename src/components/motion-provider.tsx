"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import { motionPresets } from "@/lib/motion";

// Animation features load in their own chunk once something animates.
// `strict` keeps components on the light `m` API rather than the full
// `motion` bundle.
const loadFeatures = () =>
  import("./motion-features").then((features) => features.default);

/**
 * Wrap any subtree that animates with Motion. It sits around animated
 * sections rather than in the root layout, so pages without animation ship
 * no Motion code. `m` components animate only inside it, and it always honours
 * the visitor's reduced-motion setting, so every animation on the site does.
 * An animation with no transition of its own moves processionally.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{
        duration: motionPresets.processional.duration,
        ease: [...motionPresets.processional.ease],
      }}
    >
      <LazyMotion features={loadFeatures} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}
