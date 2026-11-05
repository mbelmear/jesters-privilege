import { LISTEN_MARKS } from "./listen-icon";
import { SOCIAL_MARKS } from "./social-icon";

// A Server Component's markup reaches the page twice, in its HTML and again in
// the data React reads to take the page over, so an outline drawn inline is
// paid twice on every page that shows it, the footer's on every page. One
// larger than this lives in public/icons/ as a symbol, drawn with { href }:
// #117's Amazon Music wordmark, 6.8 KB inline, added 5 to 6.5 KB to every
// page's early bytes (docs/testing.md, Performance).
const MAX_INLINE_PATH = 2500;

describe("brand marks", () => {
  it.each([...Object.entries(LISTEN_MARKS), ...Object.entries(SOCIAL_MARKS)])(
    "draws %s inline only if its outline is small",
    (_name, source) => {
      if ("path" in source) {
        expect(source.path.length).toBeLessThanOrEqual(MAX_INLINE_PATH);
      }
    }
  );
});
