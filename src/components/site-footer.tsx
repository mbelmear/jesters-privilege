import type { ReactNode } from "react";
import { ListenIcon } from "@/components/listen-icon";
import { SocialIcon } from "@/components/social-icon";
import { ThemedLogo } from "@/components/themed-logo";
import { Button } from "@/components/ui/button";
import {
  LISTEN_PLATFORMS,
  SOCIAL_NETWORKS,
  type ListenCopy,
  type Shell,
  type Site,
} from "@/lib/content";

type Props = {
  site: Site;
  shell: Pick<Shell, "footer" | "logo" | "nav">;
  // Each app's name, for its icon's hidden label.
  platforms: ListenCopy["platforms"];
  // Episodes shows in Explore only once there are Episodes, as in the header.
  episodeCount: number;
  // The copyright year, from the build.
  year: number;
};

const linkClass =
  "text-primary underline underline-offset-3 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * A map of the site (docs/spec.md, Design system, Footer): the logo and the
 * site's description; Explore, its sections; Listen, the show's apps; Follow,
 * its social accounts; then a strip with the contact email, the privacy note,
 * copyright, and the ESV notice. Stacked on phones. Each Listen link and
 * social link is an icon with a hidden name, and shows once it's filled in.
 * Footer UI text is semibold, like the header's, so the shell loads one Barlow
 * weight.
 */
export function SiteFooter({
  site,
  shell,
  platforms,
  episodeCount,
  year,
}: Props) {
  const { footer: copy, logo } = shell;
  const sections = shell.nav.filter(
    (item) => !item.onlyWithEpisodes || episodeCount > 0
  );
  const listen = LISTEN_PLATFORMS.flatMap((platform) => {
    const href = site.listen[platform];
    return href
      ? [
          {
            key: platform,
            href,
            name: platforms[platform],
            icon: <ListenIcon platform={platform} />,
          },
        ]
      : [];
  });
  const social = SOCIAL_NETWORKS.flatMap((network) => {
    const href = site.social[network];
    return href
      ? [
          {
            key: network,
            href,
            name: copy.social[network],
            icon: <SocialIcon network={network} />,
          },
        ]
      : [];
  });
  return (
    <footer className="mt-auto border-t-4 border-brand bg-muted">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-3">
            {/* Decorative: the name is in the copyright line. */}
            <span className="flex h-12">
              <ThemedLogo
                logo={logo.icon}
                alt=""
                sizes="48px"
                className="h-full w-auto"
              />
            </span>
            <p className="max-w-xs text-muted-foreground">
              {site.description.text}
            </p>
          </div>
          <FooterPart id="footer-explore" title={copy.explore}>
            <ul className="flex flex-col gap-2 font-ui text-base font-semibold">
              {sections.map(({ href, label }) => (
                <li key={href}>
                  <a href={href} className={linkClass}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </FooterPart>
          {listen.length > 0 && (
            <FooterPart id="footer-listen" title={copy.listen}>
              <IconLinks links={listen} />
            </FooterPart>
          )}
          {social.length > 0 && (
            <FooterPart id="footer-follow" title={copy.follow}>
              <IconLinks links={social} />
            </FooterPart>
          )}
        </div>
        <div className="flex flex-col gap-3 border-t border-border pt-6 text-sm text-muted-foreground">
          <p className="font-ui text-base font-semibold">
            <span>{copy.contact}: </span>
            <a href={`mailto:${site.contactEmail}`} className={linkClass}>
              {site.contactEmail}
            </a>
          </p>
          <p className="max-w-prose">{copy.privacyNote.text}</p>
          <p className="font-ui font-semibold">
            © {year} {site.name}
          </p>
          <p className="max-w-prose text-xs">{copy.esvNotice.text}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterPart({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <nav aria-labelledby={id} className="flex flex-col gap-3">
      <h2
        id={id}
        className="font-ui text-sm font-semibold tracking-widest text-muted-foreground uppercase"
      >
        {title}
      </h2>
      {children}
    </nav>
  );
}

function IconLinks({
  links,
}: {
  links: readonly {
    key: string;
    href: string;
    name: string;
    icon: ReactNode;
  }[];
}) {
  return (
    <ul className="-ml-2 flex flex-wrap">
      {links.map(({ key, href, name, icon }) => (
        <li key={key}>
          <Button asChild variant="ghost" size="icon" className="text-primary">
            <a href={href}>
              {icon}
              <span className="sr-only">{name}</span>
            </a>
          </Button>
        </li>
      ))}
    </ul>
  );
}
