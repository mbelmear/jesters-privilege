import { validateContent } from "@/lib/content";
import { about } from "./about";
import { episodePage } from "./episode-page";
import { episodes } from "./episodes";
import { gallery } from "./gallery";
import { hero } from "./hero";
import { home } from "./home";
import { jesters } from "./jesters";
import { listen } from "./listen";
import { microcopy } from "./microcopy";
import { paintings } from "./paintings";
import { shell } from "./shell";
import { site } from "./site";
import { speakFreely } from "./speak-freely";

// Everything pages show, validated when the build loads it: content that
// breaks a rule fails the build with a message naming where and why.
export const content = validateContent({
  site,
  paintings,
  shell,
  hero,
  home,
  listen,
  episodePage,
  episodes,
  jesters,
  gallery,
  about,
  speakFreely,
  microcopy,
});

// Where a page's link to a section leads: the section's address in the site's
// navigation (shell.ts), so a renamed address can't leave a stale link.
export function sectionHref(label: string): string {
  const item = content.shell.nav.find((nav) => nav.label === label);
  if (!item) throw new Error(`Content shell.nav has no section "${label}"`);
  return item.href;
}
