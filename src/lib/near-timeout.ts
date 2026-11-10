// A browser test that passes using most of its time fails on the next slow
// runner: in #199's Nightly, the hover sweep timed out on one run and passed
// at 28.3-29.5 s of its 30 s on the other three.
// e2e/near-timeout-reporter.ts names each one, so it's seen while it passes.

/** The share of its timeout past which a passing test is near it. */
export const NEAR_TIMEOUT_SHARE = 0.6;

/** One finished attempt at a test, as Playwright reports it. */
export interface Attempt {
  status: string;
  duration: number;
  timeout: number;
}

/** What the Nightly issue reads a near-timeout test from (nightly-report.ts). */
export const NEAR_TIMEOUT = "Near its timeout";

/** A near-timeout test, from what Playwright knows of it. */
export interface NearTimeout extends Omit<Attempt, "status"> {
  project: string;
  /** Relative to the repo, as Playwright's summary prints it. */
  file: string;
  line: number;
  column: number;
  /** Its describe blocks, then its own title. */
  titles: string[];
}

const seconds = (ms: number) => `${Number((ms / 1000).toFixed(1))} s`;

/** The test as Playwright's summary names a failed one, with its time. */
export function nearTimeoutLine(test: NearTimeout): string {
  const name = [`${test.file}:${test.line}:${test.column}`, ...test.titles];
  return `${NEAR_TIMEOUT}: [${test.project}] ${name.join(" › ")} took ${seconds(test.duration)} of ${seconds(test.timeout)}`;
}

/** Whether an attempt passed with too little time to spare. */
export function nearTimeout({ status, duration, timeout }: Attempt): boolean {
  return (
    status === "passed" &&
    timeout > 0 &&
    duration > timeout * NEAR_TIMEOUT_SHARE
  );
}
