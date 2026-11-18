// The class names a compiled stylesheet holds: what scripts/compiled-classes.ts
// lists for the stylesheet every page loads (CODING_STANDARDS.md, Performance).

/** Every class a stylesheet's rules select, each once, unescaped. */
export function classesIn(css: string): string[] {
  // A rule's selector is what precedes its "{". A class can sit anywhere in
  // it, after a parent's class or inside :is(), as a child variant's does.
  const selectors = css
    .split("\n")
    .filter((line) => line.includes("{"))
    .map((line) => line.slice(0, line.indexOf("{")));
  const names = selectors.flatMap((selector) =>
    [...selector.matchAll(/\.((?:\\.|[^\s,:.[\]>+~()*])+)/g)].map(([, name]) =>
      name.replace(/\\(.)/g, "$1")
    )
  );
  return [...new Set(names)].sort();
}
