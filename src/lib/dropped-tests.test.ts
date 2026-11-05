import { droppedTests } from "./dropped-tests";

// `playwright test --list`, as the base and the head print it.
const listing = (...tests: string[]) =>
  [
    "Listing tests:",
    ...tests.map((t) => `  ${t}`),
    "Total: 9 tests in 1 file",
  ].join("\n");

const RESUME =
  "player.spec.ts:40:7 › Persistent player › resumes a partly heard Episode";
const CLOSE = "player.spec.ts:90:7 › Persistent player › closes by keyboard";

describe("droppedTests", () => {
  it("names a test the head no longer has, once across its projects", () => {
    const base = listing(
      `[chromium-phone] › ${RESUME}`,
      `[webkit-phone] › ${RESUME}`,
      `[chromium-phone] › ${CLOSE}`
    );
    const head = listing(`[chromium-phone] › ${CLOSE}`);
    expect(droppedTests(base, head)).toEqual([
      "player.spec.ts › Persistent player › resumes a partly heard Episode",
    ]);
  });

  it("doesn't count a test that only moved within its file", () => {
    const moved = CLOSE.replace(":90:7", ":48:7");
    expect(
      droppedTests(
        listing(`[chromium-phone] › ${CLOSE}`),
        listing(`[chromium-phone] › ${moved}`)
      )
    ).toEqual([]);
  });

  it("doesn't count a test the head adds", () => {
    expect(
      droppedTests(
        listing(`[chromium-phone] › ${CLOSE}`),
        listing(`[chromium-phone] › ${CLOSE}`, `[chromium-phone] › ${RESUME}`)
      )
    ).toEqual([]);
  });

  it("refuses a listing with no tests, so a broken run can't read as clean", () => {
    expect(() =>
      droppedTests(listing(`[chromium-phone] › ${CLOSE}`), "Error: no out/")
    ).toThrow("no tests");
  });
});
