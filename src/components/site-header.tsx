import Link from "next/link";
import { HeaderFrame } from "@/components/header-frame";
import { MobileMenu } from "@/components/mobile-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemedLogo } from "@/components/themed-logo";
import type { Shell } from "@/lib/content";
import { cn, focusRing } from "@/lib/utils";

type Props = {
  shell: Shell;
  // How many Episodes are published; with none, Episodes isn't listed.
  episodeCount: number;
};

export function SiteHeader({ shell, episodeCount }: Props) {
  const items = shell.nav.filter(
    (item) => !item.onlyWithEpisodes || episodeCount > 0
  );
  const menu = { items, labels: shell.menu, navLabel: shell.navLabel };
  return (
    <HeaderFrame>
      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Named by the link, as only one of its four images shows. */}
        <Link
          href="/"
          aria-label={shell.homeLink}
          className={cn("flex h-full shrink-0 py-2", focusRing)}
        >
          {/* The icon on phones, the wordmark from md up; at most 56px tall.
              Lazy, so the browser fetches only the one image that shows
              rather than all four ahead of the page's largest paint. */}
          <span className="flex h-full md:hidden">
            <ThemedLogo
              logo={shell.logo.icon}
              alt={shell.logo.alt}
              sizes="48px"
              className="h-full w-auto"
            />
          </span>
          <span className="hidden h-full md:flex">
            <ThemedLogo
              logo={shell.logo.wordmark}
              alt={shell.logo.alt}
              sizes="140px"
              className="h-full w-auto"
            />
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <nav aria-label={shell.navLabel} className="hidden md:block">
            <ul className="flex items-center gap-1">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "inline-flex h-11 items-center rounded-md px-3 font-ui text-base font-semibold tracking-wider text-foreground uppercase no-underline transition-[background-color] duration-(--motion-courtly-duration) ease-courtly hover:bg-muted",
                      focusRing
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <ThemeToggle label={shell.themeToggle} />
          <div className="md:hidden">
            <MobileMenu menu={menu} />
          </div>
        </div>
      </div>
    </HeaderFrame>
  );
}
