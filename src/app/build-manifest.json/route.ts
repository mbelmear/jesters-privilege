import type { BuildManifest } from "@/lib/build-manifest";

export const dynamic = "force-static";

export function GET() {
  const manifest: BuildManifest = {
    // Stays null until feed ingestion (#11) supplies the newest Episode.
    newestEpisodeGuid: null,
    commit: process.env.BUILD_COMMIT ?? null,
  };
  return Response.json(manifest);
}
