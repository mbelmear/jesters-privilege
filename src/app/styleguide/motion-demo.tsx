"use client";

import { m } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motionPresets } from "@/lib/motion";

type PresetName = keyof typeof motionPresets;

/** A bar that sweeps in with the given preset, replayable on demand. */
export function MotionDemo({
  preset,
  replayLabel,
}: {
  preset: PresetName;
  replayLabel: string;
}) {
  const [run, setRun] = useState(0);
  const { duration, ease } = motionPresets[preset];

  return (
    <div className="flex items-center gap-3">
      <div className="h-3 flex-1 overflow-hidden rounded-sm bg-muted">
        <m.div
          key={run}
          className="h-full origin-left bg-brand"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration, ease: [...ease] }}
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setRun((count) => count + 1)}
        aria-label={`${replayLabel} ${preset}`}
      >
        {replayLabel}
      </Button>
    </div>
  );
}
