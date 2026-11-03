// Cloudflare Web Analytics: cookieless, so no consent banner. The token is
// null on every build but production (src/lib/analytics.ts).
export function WebAnalytics({ token }: { token: string | null }) {
  if (token === null) return null;
  return (
    <script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token })}
    />
  );
}
