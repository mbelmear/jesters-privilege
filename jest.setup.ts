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
