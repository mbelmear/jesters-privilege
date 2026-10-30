import { validateContent } from "@/lib/content";
import { about } from "./about";
import { gallery } from "./gallery";
import { hero } from "./hero";
import { home } from "./home";
import { jesters } from "./jesters";
import { microcopy } from "./microcopy";
import { paintings } from "./paintings";
import { shell } from "./shell";
import { site } from "./site";

// Everything pages show, validated when the build loads it: content that
// breaks a rule fails the build with a message naming where and why.
export const content = validateContent({
  site,
  paintings,
  shell,
  hero,
  home,
  jesters,
  gallery,
  about,
  microcopy,
});
