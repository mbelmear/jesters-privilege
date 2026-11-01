import { TEST_SITE_KEY, turnstileSiteKey } from "./turnstile";

describe("turnstileSiteKey", () => {
  it("uses the deploy's site key", () => {
    expect(turnstileSiteKey({ TURNSTILE_SITE_KEY: "0x4AAAAAAA-real" })).toBe(
      "0x4AAAAAAA-real"
    );
  });

  it("gives any other build Turnstile's always-pass test key", () => {
    expect(turnstileSiteKey({})).toBe("1x00000000000000000000AA");
    expect(TEST_SITE_KEY).toBe("1x00000000000000000000AA");
  });

  it("fails a deploy whose secret is missing, which sets the key empty", () => {
    expect(() => turnstileSiteKey({ TURNSTILE_SITE_KEY: "" })).toThrow(
      "TURNSTILE_SITE_KEY is set but empty"
    );
  });
});
