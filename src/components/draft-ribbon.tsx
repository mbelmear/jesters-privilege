import { content } from "@/content";
import { findDrafts, type ContentValue } from "@/lib/content";

// Previews and `next dev` mark drafts; production builds never do.
const isPreviewBuild =
  process.env.SITE_ENV === "preview" || process.env.NODE_ENV === "development";

type Props = {
  // Everything the page shows from content files.
  uses: readonly ContentValue[];
  preview?: boolean;
};

export function DraftRibbon({ uses, preview = isPreviewBuild }: Props) {
  if (!preview || findDrafts(uses).length === 0) return null;
  return (
    <p
      role="note"
      aria-label={content.microcopy.draftRibbonNote.text}
      className="pointer-events-none fixed top-6 -right-12 z-50 w-48 rotate-45 bg-foreground py-1 text-center text-sm font-bold tracking-widest text-background uppercase shadow-md"
    >
      {content.microcopy.draftRibbon.text}
    </p>
  );
}
