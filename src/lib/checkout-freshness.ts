// A warning for a command whose answer depends on the code it runs from, such
// as `npm run launch-check` run in a main checkout that has fallen behind.

export function behindWarning(commitsBehind: number): string | null {
  if (commitsBehind === 0) return null;
  const commits = commitsBehind === 1 ? "1 commit" : `${commitsBehind} commits`;
  return `This checkout is ${commits} behind origin/main, so what follows may be out of date. Pull first.`;
}
