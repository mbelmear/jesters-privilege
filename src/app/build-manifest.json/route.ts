import {
  getEpisodes,
  getListedEpisodes,
  getTranscribedEpisodes,
} from "@/content/feed";
import type { BuildManifest } from "@/lib/build-manifest";

export const dynamic = "force-static";

export async function GET() {
  const [newest] = await getEpisodes();
  const manifest: BuildManifest = {
    newestEpisodeGuid: newest?.guid ?? null,
    commit: process.env.BUILD_COMMIT ?? null,
    episodeListenLinks: await getListedEpisodes(),
    transcripts: await getTranscribedEpisodes(),
  };
  return Response.json(manifest);
}
