import { loadFeedText, type FeedIO } from "./feed-source";

const url = "https://www.spreaker.com/show/6900001/episodes/feed";

function io(overrides: Partial<FeedIO>): FeedIO {
  return {
    fetch: () => Promise.reject(new Error("fetch not expected")),
    readFile: () => Promise.reject(new Error("readFile not expected")),
    ...overrides,
  };
}

function response(status: number, statusText: string, body = "") {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: () => Promise.resolve(body),
  });
}

describe("loadFeedText", () => {
  it("reads the fixture while the real feed doesn't exist yet", async () => {
    const text = await loadFeedText(
      { kind: "fixture", path: "src/content/feed-fixture.xml", draft: true },
      io({
        readFile: (path) =>
          Promise.resolve(
            path === "src/content/feed-fixture.xml" ? "<rss/>" : ""
          ),
      })
    );
    expect(text).toBe("<rss/>");
  });

  it("downloads the real feed", async () => {
    const text = await loadFeedText(
      { kind: "url", url },
      io({ fetch: (u) => response(200, "OK", u === url ? "<rss/>" : "") })
    );
    expect(text).toBe("<rss/>");
  });

  it("fails the build when the feed can't be reached", async () => {
    await expect(
      loadFeedText(
        { kind: "url", url },
        io({ fetch: () => Promise.reject(new TypeError("fetch failed")) })
      )
    ).rejects.toThrow(`Feed ${url} couldn't be reached: fetch failed`);
  });

  it("fails the build when the feed answers with an error", async () => {
    await expect(
      loadFeedText(
        { kind: "url", url },
        io({ fetch: () => response(503, "Service Unavailable", "<html/>") })
      )
    ).rejects.toThrow(`Feed ${url} answered 503 Service Unavailable`);
  });
});
