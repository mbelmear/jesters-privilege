// Which browser tests a pull request removes, from `playwright test --list` on
// its base and its head (scripts/dropped-tests.ts). A test's line can change,
// so it's known by its file and titles.

const LISTED_TEST = /^\s*\[[^\]]+\] › (.+?):\d+:\d+ › (.+)$/gm;

function listedTests(listing: string, side: string): Set<string> {
  const tests = [...listing.matchAll(LISTED_TEST)].map(
    ([, file, titles]) => `${file} › ${titles}`
  );
  if (tests.length === 0) {
    throw new Error(`The ${side}'s listing has no tests:\n${listing}`);
  }
  return new Set(tests);
}

/** The tests the base lists that the head doesn't, once across projects. */
export function droppedTests(base: string, head: string): string[] {
  const kept = listedTests(head, "head");
  return [...listedTests(base, "base")].filter((test) => !kept.has(test));
}
