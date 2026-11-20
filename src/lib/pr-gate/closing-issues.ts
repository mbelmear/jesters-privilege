// Merging a PR must close only the issues it names. GitHub closes every issue
// that follows "fix", "close" or "resolve" in the body: #211's "Fix #209
// before #145." closed #209 on merge. The squash merge's body is the PR's
// commit messages (the repo's squash_merge_commit_message is
// COMMIT_MESSAGES), and GitHub closes what they name too, which its
// closingIssuesReferences leaves out: #213's commit quoted #211's line and
// closed #209 again. A ticket a PR means to close goes in its title or its
// body's first line, as "Closes #181, closes #200." does.
import type { PrContents } from "./github";
import { Refusal } from "./snapshot";

// GitHub's keywords, then an optional colon, before #N, owner/repo#N, or an
// issue's URL.
const CLOSES =
  /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):?\s+(?:#|[\w.-]+\/[\w.-]+#|https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/)([0-9]+)/gi;

const closes = (text: string) =>
  [...text.matchAll(CLOSES)].map((match) => Number(match[1]));

/** The issues merging would close that neither the title names nor the body's first line closes, in order. */
export function unnamedClosures({
  title,
  body,
  closingIssues,
  commitMessages,
}: PrContents): number[] {
  const own = new Set([
    ...[...title.matchAll(/#([0-9]+)/g)].map((match) => Number(match[1])),
    ...closes(body.split("\n")[0] ?? ""),
  ]);
  const closed = new Set([...closingIssues, ...commitMessages.flatMap(closes)]);
  return [...closed].filter((n) => !own.has(n)).sort((a, b) => a - b);
}

export function requireNamedClosures(
  pr: number,
  contents: PrContents,
  action: string
) {
  const unnamed = unnamedClosures(contents);
  if (!unnamed.length) return;
  throw new Refusal(
    [
      `Refusing to ${action} #${pr}: merging it closes ${unnamed.map((n) => `#${n}`).join(", ")}, which neither its title names nor its body's first line closes.`,
      `GitHub closes an issue after "fix", "close" or "resolve" anywhere in the body or a commit message.`,
      `Reword that line ("#209 needs fixing first"; amend or rebase for a commit),`,
      `or put "Closes #N." in the body's first line if it should close, then rerun.`,
    ].join("\n")
  );
}
