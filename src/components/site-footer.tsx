import { SOCIAL_NETWORKS, type Shell, type Site } from "@/lib/content";

type Props = {
  site: Site;
  copy: Shell["footer"];
  // The copyright year, from the build.
  year: number;
};

const linkClass =
  "text-primary underline underline-offset-3 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

// Each social link and the RSS link appear once they're filled in. Footer UI
// text is semibold, like the header's, so the shell loads one Barlow weight.
export function SiteFooter({ site, copy, year }: Props) {
  const social = SOCIAL_NETWORKS.flatMap((network) => {
    const href = site.social[network];
    return href ? [{ network, href }] : [];
  });
  const rss = site.listen.rss;
  return (
    <footer className="mt-auto border-t-4 border-brand bg-muted">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-3 font-ui text-base font-semibold sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8">
          <p>
            <span className="text-muted-foreground">{copy.contact}: </span>
            <a href={`mailto:${site.contactEmail}`} className={linkClass}>
              {site.contactEmail}
            </a>
          </p>
          {social.length > 0 && (
            <ul
              aria-label={copy.socialLabel}
              className="flex flex-wrap gap-x-5"
            >
              {social.map(({ network, href }) => (
                <li key={network}>
                  <a href={href} className={linkClass}>
                    {copy.social[network]}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {rss && (
            <p>
              <a href={rss} className={linkClass}>
                {copy.rss}
              </a>
            </p>
          )}
        </div>
        <p className="max-w-prose text-sm text-muted-foreground">
          {copy.privacyNote.text}
        </p>
        <p className="font-ui text-sm font-semibold text-muted-foreground">
          © {year} {site.name}
        </p>
      </div>
    </footer>
  );
}
