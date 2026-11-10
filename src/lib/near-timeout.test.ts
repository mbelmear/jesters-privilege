import { nearTimeout, nearTimeoutLine } from "./near-timeout";

describe("nearTimeoutLine", () => {
  it("names the test as a failed one is named, with its time and timeout", () => {
    expect(
      nearTimeoutLine({
        project: "firefox-phone",
        file: "e2e/sweep.spec.ts",
        line: 114,
        column: 9,
        titles: ["Every button", "keeps its contrast while hovered (dark)"],
        duration: 29_512,
        timeout: 30_000,
      })
    ).toBe(
      "Near its timeout: [firefox-phone] e2e/sweep.spec.ts:114:9 › Every button › keeps its contrast while hovered (dark) took 29.5 s of 30 s"
    );
  });
});

describe("nearTimeout", () => {
  it("flags a test that passed using most of its time", () => {
    expect(
      nearTimeout({ status: "passed", duration: 28_300, timeout: 30_000 })
    ).toBe(true);
  });

  it("leaves a test that passed with time to spare", () => {
    expect(
      nearTimeout({ status: "passed", duration: 7_500, timeout: 30_000 })
    ).toBe(false);
  });

  // test.setTimeout(0) turns the timeout off.
  it("leaves a test with no timeout", () => {
    expect(
      nearTimeout({ status: "passed", duration: 90_000, timeout: 0 })
    ).toBe(false);
  });
});
