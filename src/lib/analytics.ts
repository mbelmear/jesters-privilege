// Cloudflare Web Analytics counts visits to the live site only: previews, CI,
// and local builds would muddy the Jesters' numbers. The production deploy
// sets SITE_ENV=production and passes the site's beacon token, which isn't
// secret (every page's source carries it).
export type AnalyticsEnv = {
  SITE_ENV?: string;
  WEB_ANALYTICS_TOKEN?: string;
};

// The beacon's token for this build, or null when it shouldn't count visits.
export function analyticsToken(env: AnalyticsEnv): string | null {
  if (env.SITE_ENV !== "production") return null;
  const token = env.WEB_ANALYTICS_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "Analytics: the production build has no WEB_ANALYTICS_TOKEN; set the repository variable to the site's token from Cloudflare Web Analytics (docs/deploy.md)"
    );
  }
  return token;
}
