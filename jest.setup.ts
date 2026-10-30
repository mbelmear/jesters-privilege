import { format } from "node:util";
import "@testing-library/jest-dom";
import { toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

// jsdom has no IntersectionObserver. Without one, next/link marks itself
// visible on a timer to prefetch, updating state after a test ends; an
// observer that never fires keeps links still, as off-screen ones are.
class StillIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
// Node-environment suites (the Worker, Submit) have no window.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "IntersectionObserver", {
    writable: true,
    value: StillIntersectionObserver,
  });
}

// A test that writes to console.error or console.warn fails, naming what was
// written: React's act() warnings and prop-type errors are bugs, and timing can
// hide them on a fast laptop that CI's slower runner shows. A test that expects
// an error stubs it with jest.spyOn(console, "error").mockImplementation().
const consoleCalls: string[] = [];
for (const method of ["error", "warn"] as const) {
  const original = console[method];
  console[method] = (...args: unknown[]) => {
    consoleCalls.push(`console.${method}: ${format(...args)}`);
    original(...args);
  };
}
const assertQuietConsole = () => {
  const calls = consoleCalls.splice(0);
  if (calls.length > 0) {
    throw new Error(
      `The test wrote to the console (stub it if expected):\n${calls.join("\n")}`
    );
  }
};
// A late write, such as an update that lands after a test ends, fails the
// next test in the file, or the file itself.
afterEach(assertQuietConsole);
afterAll(assertQuietConsole);
