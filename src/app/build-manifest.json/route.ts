import { getBuildRecord } from "@/content/feed";
import type { BuildManifest } from "@/lib/build-manifest";

export const dynamic = "force-static";

export async function GET() {
  const { newestEpisodeGuid, episodeListenLinks, transcripts } =
    await getBuildRecord();
  // Fields in the order the manifest has always had, so its JSON is unchanged.
  const manifest: BuildManifest = {
    newestEpisodeGuid,
    commit: process.env.BUILD_COMMIT ?? null,
    episodeListenLinks,
    transcripts,
  };
  return Response.json(manifest);
}
