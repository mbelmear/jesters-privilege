import type { Inline, Paragraph } from "@/lib/content";

const text = (run: Inline) => (typeof run === "string" ? run : run.em);

/** A Jester's full bio as they wrote it, with show titles in italics. */
export function JesterBio({
  paragraphs,
}: {
  paragraphs: readonly Paragraph[];
}) {
  return paragraphs.map((paragraph) => (
    <p key={paragraph.map(text).join("")}>
      {paragraph.map((run) =>
        typeof run === "string" ? run : <em key={run.em}>{run.em}</em>
      )}
    </p>
  ));
}
