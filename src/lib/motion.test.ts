import { motionCss, motionPresets, transitionFor } from "./motion";

describe("motionPresets", () => {
  it("makes the processional reveal slower than the courtly menu", () => {
    expect(motionPresets.processional.duration).toBeGreaterThan(
      motionPresets.courtly.duration
    );
  });
});

describe("motionCss", () => {
  it("exposes each preset to CSS as an easing and a duration", () => {
    expect(
      motionCss({
        processional: { duration: 0.9, ease: [0.22, 0.61, 0.36, 1] },
        courtly: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
      })
    ).toBe(
      ":root{" +
        "--motion-processional-ease:cubic-bezier(0.22, 0.61, 0.36, 1);" +
        "--motion-processional-duration:900ms;" +
        "--motion-courtly-ease:cubic-bezier(0.4, 0, 0.2, 1);" +
        "--motion-courtly-duration:200ms;" +
        "}"
    );
  });
});

describe("transitionFor", () => {
  it("turns a preset into a Motion transition", () => {
    expect(transitionFor({ duration: 0.2, ease: [0.4, 0, 0.2, 1] })).toEqual({
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1],
    });
  });
});
