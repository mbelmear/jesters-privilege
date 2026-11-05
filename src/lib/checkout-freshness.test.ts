import { behindWarning } from "./checkout-freshness";

describe("behindWarning", () => {
  it("says how far behind a checkout is, and what to do", () => {
    expect(behindWarning(3)).toBe(
      "This checkout is 3 commits behind origin/main, so what follows may be out of date. Pull first."
    );
    expect(behindWarning(1)).toContain("1 commit behind");
  });

  it("says nothing for a checkout that's current", () => {
    expect(behindWarning(0)).toBeNull();
  });
});
