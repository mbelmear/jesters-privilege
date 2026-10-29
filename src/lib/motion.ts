// The site's motion presets, defined once. Motion components use them
// directly; CSS (Tailwind's ease-*/duration-* tokens in globals.css) reads the
// same values through the custom properties `motionCss` writes into <head>.

type CubicBezier = readonly [number, number, number, number];
type MotionPreset = { readonly duration: number; readonly ease: CubicBezier };

export const motionPresets = {
  /** Slow and stately, for reveals: paintings, hero copy, sections. */
  processional: { duration: 0.9, ease: [0.22, 0.61, 0.36, 1] },
  /** Quick and polite, for menus, dialogs, and other interface responses. */
  courtly: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
} as const satisfies Record<string, MotionPreset>;

/** A preset as a Motion `transition`, which wants a mutable easing array. */
export function transitionFor({ duration, ease }: MotionPreset): {
  duration: number;
  ease: [number, number, number, number];
} {
  const [x1, y1, x2, y2] = ease;
  return { duration, ease: [x1, y1, x2, y2] };
}

/** A `:root` rule giving each preset to CSS as `--motion-<name>-ease/-duration`. */
export function motionCss(presets: Record<string, MotionPreset>): string {
  const declarations = Object.entries(presets).map(
    ([name, { duration, ease }]) =>
      `--motion-${name}-ease:cubic-bezier(${ease.join(", ")});` +
      `--motion-${name}-duration:${Math.round(duration * 1000)}ms;`
  );
  return `:root{${declarations.join("")}}`;
}
