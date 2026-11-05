// Whether the built site in out/ shows the current source, so a screenshot
// of it shows the change under review (scripts/screenshots.ts). With no
// build, serve answers every page with a 404; with a stale one, the
// screenshots look right and show old code.

export type SourceFile = { path: string; modifiedMs: number };

export type BuildFreshness =
  { kind: "missing" } | { kind: "stale"; newest: string } | { kind: "fresh" };

// `builtMs` is when out/index.html was written, or null when there is none.
// Tests are left out: they change nothing a visitor sees.
export function buildFreshness(
  builtMs: number | null,
  sources: readonly SourceFile[]
): BuildFreshness {
  if (builtMs === null) return { kind: "missing" };
  const newest = sources
    .filter(({ path }) => !/\.test\.tsx?$/.test(path))
    .reduce<SourceFile | null>(
      (latest, file) =>
        latest === null || file.modifiedMs > latest.modifiedMs ? file : latest,
      null
    );
  return newest !== null && newest.modifiedMs > builtMs
    ? { kind: "stale", newest: newest.path }
    : { kind: "fresh" };
}
