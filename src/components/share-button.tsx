"use client";

import { Share } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { EpisodePage } from "@/lib/content";
import { momentLabel } from "@/lib/moment";
import { browserSharing, shareLink, type ShareOutcome } from "@/lib/share";
import type { MomentShare } from "./use-episode-visit";

type Props = {
  // What the share sheet names the link.
  title: string;
  // The page's path; the link shared is it on whichever site serves it.
  path: string;
  // Whether Share can send a Moment link, and which: the page's Visit.
  share: MomentShare;
  copy: EpisodePage["share"];
  momentCopy: EpisodePage["moment"];
};

/**
 * Shares an Episode page: the phone's share sheet where the browser has one,
 * otherwise copying the link, with a note saying it was copied. While the
 * Episode is in the player, a box by Share sends a Moment link instead, a
 * little before where the player is.
 */
export function ShareButton({ title, path, share, copy, momentCopy }: Props) {
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  const boxId = useId();
  const { moment } = share;

  function send() {
    setOutcome(null);
    const url = new URL(path, window.location.origin).href;
    const target = share.target({ title, url }, momentCopy.shareText.text);
    // shareLink reports its own failures; anything else still says so.
    shareLink(target, browserSharing()).then(setOutcome, () =>
      setOutcome("failed")
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="lg" onClick={send}>
          <Share aria-hidden="true" />
          {copy.button}
        </Button>
        {moment !== null && (
          // Not a live region: the time changes every second while it plays.
          <div className="flex items-center gap-2">
            <Checkbox
              id={boxId}
              checked={share.frozen}
              onCheckedChange={(checked) => share.setFrozen(checked === true)}
            />
            <label
              htmlFor={boxId}
              className="font-ui text-sm font-semibold tabular-nums"
            >
              {momentLabel(momentCopy.shareFrom.text, moment)}
            </label>
          </div>
        )}
      </div>
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
      return copy.copied.text;
    case "failed":
      return copy.failed.text;
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
