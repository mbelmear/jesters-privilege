// Compares two screenshots pixel by pixel, for a visual PR's before and after
// (scripts/screenshots-compare.ts). `cmp` only says whether two files differ;
// this says where, so "identical except the label" can be checked rather than
// eyeballed (#249's retro).

export type Pixels = { width: number; height: number; data: Uint8Array };
type Size = { width: number; height: number };
export type Region = { x: number; y: number; width: number; height: number };

export type Difference =
  | { kind: "same" }
  // The one rectangle that bounds every changed pixel.
  | { kind: "changed"; region: Region }
  // Pixels can't line up: a full-page shot grows when anything gets taller.
  | { kind: "resized"; before: Size; after: Size };

/** Where two RGBA images differ. */
export function compareImages(before: Pixels, after: Pixels): Difference {
  if (before.width !== after.width || before.height !== after.height) {
    return {
      kind: "resized",
      before: { width: before.width, height: before.height },
      after: { width: after.width, height: after.height },
    };
  }
  const { width, height } = before;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (
        before.data[i] !== after.data[i] ||
        before.data[i + 1] !== after.data[i + 1] ||
        before.data[i + 2] !== after.data[i + 2] ||
        before.data[i + 3] !== after.data[i + 3]
      ) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (right < 0) return { kind: "same" };
  return {
    kind: "changed",
    region: {
      x: left,
      y: top,
      width: right - left + 1,
      height: bottom - top + 1,
    },
  };
}

/** One line of the comparison's report, for the file named. */
export function describeDifference(name: string, diff: Difference): string {
  switch (diff.kind) {
    case "same":
      return `same     ${name}`;
    case "changed": {
      const { x, y, width, height } = diff.region;
      return `changed  ${name}  ${width}×${height} at (${x}, ${y})`;
    }
    case "resized": {
      const { before, after } = diff;
      return `resized  ${name}  ${before.width}×${before.height} → ${after.width}×${after.height}`;
    }
    default: {
      const unhandled: never = diff;
      return unhandled;
    }
  }
}
