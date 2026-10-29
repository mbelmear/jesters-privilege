import Link from "next/link";
import { HeaderFrame } from "@/components/header-frame";
import { Logo } from "@/components/logo";
import { MobileMenu } from "@/components/mobile-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Shell } from "@/lib/content";

type Props = {
  shell: Shell;
  // How many Episodes are published; with none, Episodes isn't listed.
  episodeCount: number;
};

export function SiteHeader({ shell, episodeCount }: Props) {
  const items = shell.nav.filter(
    (item) => !item.onlyWithEpisodes || episodeCount > 0
  );
  return (
    <HeaderFrame>
      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="h-full shrink-0 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Logo image={shell.logo} alt={shell.homeLink} className="h-full" />
        </Link>
        <div className="flex items-center gap-1">
          <nav aria-label={shell.navLabel} className="hidden md:block">
            <ul className="flex items-center gap-1">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-flex h-11 items-center rounded-md px-3 font-ui text-base font-semibold tracking-wider text-foreground uppercase no-underline transition-[background-color] duration-(--motion-courtly-duration) ease-courtly hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <ThemeToggle label={shell.themeToggle} />
          <div className="md:hidden">
            <MobileMenu
              items={items}
              labels={shell.menu}
              navLabel={shell.navLabel}
            />
          </div>
        </div>
      </div>
    </HeaderFrame>
  );
}
