// How long the PR gate waits for each thing, in one place.

export type Clock = { sleep: (seconds: number) => Promise<void> };

export const realClock: Clock = {
  sleep: (seconds) =>
    new Promise((resolve) => setTimeout(resolve, seconds * 1000)),
};

/** A clock that only counts its sleeps, running `onSleep` at each: what happens during the wait. */
export function fakeClock() {
  const slept: number[] = [];
  const clock = {
    slept,
    onSleep: (): void => {},
    sleep: async (seconds: number) => {
      slept.push(seconds);
      clock.onSleep();
    },
  };
  return clock;
}

export type Wait = { readonly tries: number; readonly seconds: number };

export const WAITS = {
  /** For GitHub to show the commit pushed from this checkout (#57). */
  pushedHead: { tries: 12, seconds: 5 },
  /** Checks appear a few seconds after a push. */
  checksAppear: { tries: 30, seconds: 5 },
  /** Between reads while any check is pending; it waits as long as CI runs. */
  pendingChecks: { tries: Infinity, seconds: 60 },
  /** A dropped connection or a laptop's sleep, for up to half an hour. */
  disconnected: { tries: 30, seconds: 60 },
  /** For the deploy workflow's comment naming the head it built. */
  preview: { tries: 30, seconds: 10 },
} as const satisfies Record<string, Wait>;

/**
 * Tries `attempt` until it gives an answer, sleeping between tries, and
 * gives undefined once `wait.tries` have all come back without one.
 */
export async function poll<T>(
  wait: Wait,
  clock: Clock,
  attempt: () => T | undefined | Promise<T | undefined>
): Promise<T | undefined> {
  for (let tried = 1; ; tried += 1) {
    const answer = await attempt();
    if (answer !== undefined) return answer;
    if (tried >= wait.tries) return undefined;
    await clock.sleep(wait.seconds);
  }
}
