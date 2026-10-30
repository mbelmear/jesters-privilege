// Sharing a page: the native share sheet where the browser has one (phones,
// mostly), otherwise copying the link for the visitor to paste.

export type ShareTarget = { title: string; url: string };

// What the browser can do; browserSharing() is the real one.
export type Sharing = {
  share?: (data: ShareData) => Promise<void>;
  copy: (text: string) => Promise<void>;
};

// "cancelled": the visitor closed the share sheet, so nothing needs saying.
export type ShareOutcome = "shared" | "cancelled" | "copied" | "failed";

export async function shareLink(
  target: ShareTarget,
  sharing: Sharing
): Promise<ShareOutcome> {
  if (sharing.share) {
    try {
      await sharing.share(target);
      return "shared";
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
      // Any other failure (no permission, unsupported data) falls back to
      // copying, so the visitor still gets the link.
    }
  }
  try {
    await sharing.copy(target.url);
    return "copied";
  } catch {
    return "failed";
  }
}

export function browserSharing(): Sharing {
  return {
    share:
      typeof navigator.share === "function"
        ? (data) => navigator.share(data)
        : undefined,
    copy: async (text) => {
      // Absent outside a secure context, though the type says otherwise.
      const clipboard: Clipboard | undefined = navigator.clipboard;
      if (!clipboard) {
        throw new Error("This browser has no clipboard to copy the link to");
      }
      await clipboard.writeText(text);
    },
  };
}
