const TAILWIND_SYNTAX = ["@apply", "@reference", "theme("];

/**
 * What in a CSS module needs Tailwind: syntax only its loader compiles, which
 * never sees a module, and theme variables, which it emits on every page.
 */
export function tailwindIn(css: string, theme: Set<string>): string[] {
  const syntax = TAILWIND_SYNTAX.filter((s) => css.includes(s));
  const variables = [...css.matchAll(/var\(\s*(--[\w-]+)/g)]
    .filter(([, name]) => theme.has(name))
    .map(([, name]) => `var(${name})`);
  return [...syntax, ...variables];
}

/** The variables a stylesheet's `@theme` blocks would emit when used. */
export function themeVariables(stylesheet: string): Set<string> {
  // Comments can hold braces, which would end a block early.
  const css = stylesheet.replace(/\/\*[\s\S]*?\*\//g, "");
  const names = new Set<string>();
  for (const start of css.matchAll(/@theme\b([^{]*)\{/g)) {
    // Tailwind never emits a reference block's variables.
    if (/\breference\b/.test(start[1])) continue;
    // A block can nest others (@keyframes), so count braces to its end, and
    // keep only what it declares at its own depth.
    let depth = 1;
    let own = "";
    for (
      let i = start.index + start[0].length;
      depth > 0 && i < css.length;
      i++
    ) {
      const char = css[i];
      if (char === "{") depth++;
      else if (char === "}") depth--;
      else if (depth === 1) own += char;
    }
    for (const [, name] of own.matchAll(/(--[\w-]+)\s*:/g)) names.add(name);
  }
  return names;
}
