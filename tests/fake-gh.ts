// A fake gh for a test that mocks node:child_process: a gh stub on a PATH set
// in Jest is never found, since the code spawns gh without an `env` (#164).
// Every answer is built by recorded() or madeUp(), so it says beside it
// whether gh printed it or it was made up (CODING_STANDARDS.md, TypeScript):
// #264 and #263 each took review rounds over unlabelled answers. Lint refuses
// execFileSync faked any other way in a test. A gh that fails is thrown as
// ghFailed (tests/gh-failed.ts) builds it.
import type { execFileSync } from "node:child_process";

type Day = `${number}-${number}-${number}`;

export type GhAnswer = {
  readonly stdout: string;
  readonly source: `recorded ${Day}` | "made up";
};

/** What gh printed on that day, copied as it was. Say where from beside it. */
export const recorded = (on: Day, stdout: string): GhAnswer => ({
  stdout,
  source: `recorded ${on}`,
});

/** Made up in the shape gh, or the code's own --jq, gives: it only feeds the code's logic. */
export const madeUp = (stdout: string): GhAnswer => ({
  stdout,
  source: "made up",
});

export type GhCall = {
  /** gh's arguments, joined by spaces: "issue list --state=open …". */
  readonly command: string;
  readonly args: readonly string[];
  readonly stdio: unknown;
};

/**
 * Makes the mocked execFileSync answer each gh call with `answer`, and returns
 * the calls made, in order.
 */
export function fakeGh(
  mocked: typeof execFileSync,
  answer: (args: readonly string[]) => GhAnswer
): GhCall[] {
  const calls: GhCall[] = [];
  jest.mocked(mocked).mockImplementation(((
    _file: string,
    args: readonly string[],
    options?: { stdio?: unknown }
  ) => {
    calls.push({
      command: args.join(" "),
      args: [...args],
      stdio: options?.stdio,
    });
    return answer(args).stdout;
  }) as typeof execFileSync);
  return calls;
}
