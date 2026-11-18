import { classesIn } from "@/lib/compiled-classes";

describe("classesIn", () => {
  // Made-up names: Tailwind scans this file, so a real utility here would
  // reach every page's stylesheet.
  it("reads each selected class once, unescaped", () => {
    const css = `
      .alpha { display: block; }
      .when\\:beta { &:hover { color: red; } }
      .gamma-1\\/2 { width: 50%; }
      .delta-\\[3\\.5x\\] { width: 3.5rem; }
      .epsilon:hover .alpha { color: red; }
      :is(.\\*\\:zeta > *)[data-slot="eta"] { display: flex; }
      .alpha { gap: 0; }`;
    expect(classesIn(css)).toEqual([
      "*:zeta",
      "alpha",
      "delta-[3.5x]",
      "epsilon",
      "gamma-1/2",
      "when:beta",
    ]);
  });
});
