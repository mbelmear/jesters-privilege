import { getEpisodes } from "@/content/feed";
import type { BuildManifest } from "@/lib/build-manifest";

export const dynamic = "force-static";

export async function GET() {
  const [newest] = await getEpisodes();
  const manifest: BuildManifest = {
    newestEpisodeGuid: newest?.guid ?? null,
    commit: process.env.BUILD_COMMIT ?? null,
  };
  return Response.json(manifest);
}
