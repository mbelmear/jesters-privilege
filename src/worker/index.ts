// The one Worker in front of the static export. Cloudflare routes every
// request here first (`run_worker_first` in wrangler.jsonc) so the www host can
// be redirected; everything else is served from the built files in out/.

const APEX = "jestersprivilegepodcast.com";

type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
};

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.hostname === `www.${APEX}`) {
      url.hostname = APEX;
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};

export default worker;
