"use client";

import { Share } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { EpisodePage } from "@/lib/content";
import { formatDuration } from "@/lib/format-duration";
import { momentLink, sharedMoment } from "@/lib/moment";
import { browserSharing, shareLink, type ShareOutcome } from "@/lib/share";
import { usePlayer, usePlayerState } from "./player-provider";

type Props = {
  // What the share sheet names the link.
  title: string;
  // The page's path; the link shared is it on whichever site serves it.
  path: string;
  // The Episode the page is for: while it is in the player, Share can send a
  // Moment link.
  episodeGuid: string;
  copy: EpisodePage["share"];
  momentCopy: EpisodePage["moment"];
};

/**
 * Shares an Episode page: the phone's share sheet where the browser has one,
 * otherwise copying the link, with a note saying it was copied. While the
 * Episode is in the player, a box by Share sends a Moment link instead, a
 * little before where the player is.
 */
export function ShareButton({
  title,
  path,
  episodeGuid,
  copy,
  momentCopy,
}: Props) {
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  // The moment the box held when ticked; null while it is unticked.
  const [frozen, setFrozen] = useState<number | null>(null);
  const boxId = useId();
  const state = usePlayerState(usePlayer());
  const position =
    state && state.mode !== "empty" && state.episode.guid === episodeGuid
      ? state.position
      : null;
  // A box hidden with the Episode comes back unticked.
  if (position === null && frozen !== null) setFrozen(null);
  const moment = position === null ? null : sharedMoment(position, frozen);

  function share() {
    setOutcome(null);
    const url = new URL(path, window.location.origin).href;
    const target =
      moment !== null && frozen !== null
        ? {
            title,
            url: momentLink(url, moment),
            text: `${momentCopy.shareText.text} ${formatDuration(moment)}`,
          }
        : { title, url };
    // shareLink reports its own failures; anything else still says so.
    shareLink(target, browserSharing()).then(setOutcome, () =>
      setOutcome("failed")
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Button type="button" variant="outline" size="lg" onClick={share}>
          <Share aria-hidden="true" />
          {copy.button}
        </Button>
        {moment !== null && (
          // Not a live region: the time changes every second while it plays.
          <div className="flex items-center gap-2">
            <Checkbox
              id={boxId}
              checked={frozen !== null}
              onCheckedChange={(checked) =>
                setFrozen(checked === true ? moment : null)
              }
            />
            <label
              htmlFor={boxId}
              className="font-ui text-sm font-semibold tabular-nums"
            >
              {momentCopy.startAt.text} {formatDuration(moment)}
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
