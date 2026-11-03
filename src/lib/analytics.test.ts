import { analyticsToken } from "./analytics";

describe("analyticsToken", () => {
  it("counts visits on the production build", () => {
    expect(
      analyticsToken({ SITE_ENV: "production", WEB_ANALYTICS_TOKEN: "abc123" })
    ).toBe("abc123");
  });

  it("counts nothing on previews, CI, and local builds", () => {
    for (const SITE_ENV of ["preview", undefined]) {
      expect(
        analyticsToken({ SITE_ENV, WEB_ANALYTICS_TOKEN: "abc123" })
      ).toBeNull();
    }
  });

  it("fails a production build that has no token, rather than going live uncounted", () => {
    for (const WEB_ANALYTICS_TOKEN of [undefined, "", "  "]) {
      expect(() =>
        analyticsToken({ SITE_ENV: "production", WEB_ANALYTICS_TOKEN })
      ).toThrow("WEB_ANALYTICS_TOKEN");
    }
  });
});
