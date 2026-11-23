// Sorts links by the name a visitor reads, so every set of Listen or social
// icons reads in the same alphabetical order, and a new one takes its place on
// its own (docs/spec.md, Design system).
export const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, "en");
