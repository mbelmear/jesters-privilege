import type { BuildRecord } from "@/lib/build-manifest";

export const EPISODE_1 = "https://www.spreaker.com/episode/61234567";
export const EPISODE_2 = "https://www.spreaker.com/episode/61299999";

// A build record with no Episode Listen links or Transcripts unless given some.
export const record = (
  newestEpisodeGuid: string | null,
  { episodeListenLinks = {}, transcripts = [] }: Partial<BuildRecord> = {}
): BuildRecord => ({ newestEpisodeGuid, episodeListenLinks, transcripts });
