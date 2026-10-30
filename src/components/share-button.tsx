"use client";

import { Share } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { EpisodePage } from "@/lib/content";
import { browserSharing, shareLink, type ShareOutcome } from "@/lib/share";

type Props = {
  // What the share sheet names the link.
  title: string;
  // The page's path; the link shared is it on whichever site serves it.
  path: string;
  copy: EpisodePage["share"];
};

/**
 * Shares a page: the phone's share sheet where the browser has one,
 * otherwise copying the link, with a note saying it was copied.
 */
export function ShareButton({ title, path, copy }: Props) {
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);

  async function share() {
    setOutcome(null);
    const url = new URL(path, window.location.origin).href;
    setOutcome(await shareLink({ title, url }, browserSharing()));
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="self-start"
        onClick={() => void share()}
      >
        <Share aria-hidden="true" />
        {copy.button}
      </Button>
      {/* Present from the start, so screen readers announce what fills it. */}
      <p role="status" className="font-ui text-sm text-muted-foreground">
        {message(outcome, copy)}
      </p>
    </div>
  );
}

function message(
  outcome: ShareOutcome | null,
  copy: EpisodePage["share"]
): string | null {
  switch (outcome) {
    case "copied":
      return copy.copied;
    case "failed":
      return copy.failed;
    case "shared":
    case "cancelled":
    case null:
      return null;
    default: {
      const unhandled: never = outcome;
      return unhandled;
    }
  }
}
