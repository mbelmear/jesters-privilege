// Reads every Episode's Transcript once per build, before `next build`, so
// every page and the build manifest read the same answer (src/content/feed.ts,
// getTranscriptTexts): the host's where the feed links one, the site's own
// from the `transcripts` branch otherwise (ADR 0003). An Episode left without
// one is named in the log and never fails the build. A build from the fixture
// reads its own files and needs none. Usage: npm run transcripts (run by
// build and dev)
import { writeFileSync } from "node:fs";
import {
  feedSource,
  lookUpTranscripts,
  TRANSCRIPTS_SNAPSHOT,
} from "@/content/feed";
import { serializeTranscriptTexts } from "@/lib/transcript";

if (feedSource.kind === "url") {
  lookUpTranscripts().then(
    (texts) => {
      writeFileSync(
        TRANSCRIPTS_SNAPSHOT,
        JSON.stringify(serializeTranscriptTexts(texts))
      );
      console.log(
        `Wrote ${texts.size} Episodes' Transcripts to ${TRANSCRIPTS_SNAPSHOT}`
      );
    },
    (error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    }
  );
}
