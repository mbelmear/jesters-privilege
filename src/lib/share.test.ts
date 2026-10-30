import { browserSharing, shareLink, type Sharing } from "./share";

const link = {
  title: "Episode 1: Celebrity Pastors",
  url: "https://jestersprivilegepodcast.com/episodes/1",
};

const abort = () => Promise.reject(new DOMException("Cancelled", "AbortError"));

function fakeSharing(overrides: Partial<Sharing> = {}) {
  const copied: string[] = [];
  const sharing: Sharing = {
    copy: async (text) => {
      copied.push(text);
    },
    ...overrides,
  };
  return { sharing, copied };
}

describe("shareLink", () => {
  it("opens the native share sheet where the browser has one", async () => {
    const shared: ShareData[] = [];
    const { sharing, copied } = fakeSharing({
      share: async (data) => {
        shared.push(data);
      },
    });
    expect(await shareLink(link, sharing)).toBe("shared");
    expect(shared).toEqual([link]);
    expect(copied).toEqual([]);
  });

  it("copies the link where there's no share sheet", async () => {
    const { sharing, copied } = fakeSharing();
    expect(await shareLink(link, sharing)).toBe("copied");
    expect(copied).toEqual([link.url]);
  });

  it("does nothing more when the visitor closes the share sheet", async () => {
    const { sharing, copied } = fakeSharing({ share: abort });
    expect(await shareLink(link, sharing)).toBe("cancelled");
    expect(copied).toEqual([]);
  });

  it("copies the link when the share sheet fails to open", async () => {
    const { sharing, copied } = fakeSharing({
      share: () => Promise.reject(new DOMException("No", "NotAllowedError")),
    });
    expect(await shareLink(link, sharing)).toBe("copied");
    expect(copied).toEqual([link.url]);
  });

  it("says so when the link can't be copied either", async () => {
    const { sharing } = fakeSharing({
      copy: () => Promise.reject(new Error("Clipboard blocked")),
    });
    expect(await shareLink(link, sharing)).toBe("failed");
  });
});

describe("browserSharing", () => {
  const original = { share: navigator.share, clipboard: navigator.clipboard };
  afterEach(() => {
    Object.defineProperty(navigator, "share", {
      value: original.share,
      configurable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: original.clipboard,
      configurable: true,
    });
  });

  it("offers the share sheet only where the browser has one", () => {
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
    expect(browserSharing().share).toBeUndefined();
  });

  it("shares and copies through the browser", async () => {
    const share = jest.fn<Promise<void>, [ShareData]>(async () => {});
    const writeText = jest.fn<Promise<void>, [string]>(async () => {});
    Object.defineProperty(navigator, "share", {
      value: share,
      configurable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const sharing = browserSharing();
    await sharing.share?.(link);
    await sharing.copy(link.url);
    expect(share).toHaveBeenCalledWith(link);
    expect(writeText).toHaveBeenCalledWith(link.url);
  });

  it("fails to copy where the browser has no clipboard", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    await expect(browserSharing().copy(link.url)).rejects.toThrow(
      "This browser has no clipboard to copy the link to"
    );
  });
});
