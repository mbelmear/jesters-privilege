import { findText } from "@/lib/content";
import { glyphsBeyondLatin } from "@/lib/fonts";
import { content } from ".";
import { styleguide } from "./styleguide";

// The letters the site's own copy uses beyond Google's latin subset, such as
// the ń of Stańczyk: what the self-hosted font subsets must carry
// (scripts/fonts.ts, #57).
export function contentGlyphsBeyondLatin(): string {
  return glyphsBeyondLatin(findText({ content, styleguide }));
}
