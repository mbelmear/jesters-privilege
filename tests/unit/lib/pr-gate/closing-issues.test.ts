import { requireNamedClosures } from "@/lib/pr-gate/closing-issues";
import type { PrContents } from "@/lib/pr-gate/github";

// The refusal's lines, or [] when it passes.
function refusal(
  title: string,
  body: string,
  closingIssues: number[],
  commitMessages: string[] = []
): string[] {
  const contents: PrContents = {
    title,
    body,
    closingIssues,
    commitMessages,
    files: [],
  };
  try {
    requireNamedClosures(211, contents, "merge");
    return [];
  } catch (error) {
    return String((error as Error).message).split("\n");
  }
}

const passes = (...args: Parameters<typeof refusal>) =>
  refusal(...args).length === 0;
const closes = (...args: Parameters<typeof refusal>) =>
  refusal(...args)[0] ?? "";

describe("closing issues", () => {
  it("passes a PR that closes only the issue its title names", () => {
    expect(passes("A fix (#158)", "Closes #158.\n\nMore.", [158])).toBe(true);
  });

  it("passes one that closes issues its body's first line names", () => {
    // #202's first line, the retro of #188 and #196.
    const first =
      "Part of the retro of #188 and #196. Closes #181, closes #200.";
    expect(passes("Retro of #188 and #196", first, [181, 200])).toBe(true);
  });

  it("passes one that closes nothing", () => {
    expect(passes("Retro of #158", "Fix #209 before #145.", [])).toBe(true);
  });

  // #211 said "Fix #209 before #145." in its evidence, and GitHub closed #209
  // when it merged.
  it("refuses one that would close an issue named only further down, saying how to fix it", () => {
    const body = "Closes #158.\n\n- Fix #209 before #145.";

    expect(refusal("A fix (#158)", body, [158, 209])).toEqual([
      "Refusing to merge #211: merging it closes #209, which neither its title names nor its body's first line closes.",
      'GitHub closes an issue after "fix", "close" or "resolve" anywhere in the body or a commit message.',
      'Reword that line ("#209 needs fixing first"; amend or rebase for a commit),',
      'or put "Closes #N." in the body\'s first line if it should close, then rerun.',
    ]);
  });

  it("names every issue it would close, in order", () => {
    expect(closes("A fix", "", [300, 209], ["Fixes #250"])).toContain(
      "merging it closes #209, #250, #300, which"
    );
  });

  // The squash merge's body is the PR's commit messages, and GitHub closes
  // what they name too: #213's quoted #211's line and closed #209 again.
  it("refuses a commit message that would close an issue the PR doesn't name", () => {
    const message =
      "merge refuses a PR that would close an unnamed issue\n" +
      `#211's evidence said "Fix #209 before #145.", and GitHub closed it.`;
    expect(
      closes("merge refuses (#158)", "From the retro.", [], [message])
    ).toContain("merging it closes #209,");
  });

  it("passes a commit message that closes the issue the title names", () => {
    expect(passes("A fix (#158)", "", [158], ["A fix\nCloses #158."])).toBe(
      true
    );
  });

  it.each(["Fixes: #209", "resolved #209", "CLOSED #209", "fix #209"])(
    "reads GitHub's keyword in %s",
    (line) => {
      expect(passes("A fix (#158)", "", [], [`A fix\n${line}`])).toBe(false);
    }
  );

  it.each([
    "Fixes mbelmear/jesters-privilege#209",
    "Fixes https://github.com/mbelmear/jesters-privilege/issues/209",
  ])("reads the issue %s names", (line) => {
    expect(closes("A fix (#158)", "", [], [`A fix\n${line}`])).toContain(
      "closes #209,"
    );
  });

  it("tells #1580 from the #158 a title names", () => {
    expect(closes("A fix (#158)", "", [], ["A fix\nFixes #1580"])).toContain(
      "closes #1580,"
    );
  });

  it.each(["prefix #209", "fixing #209", "closer to #209"])(
    "reads no keyword in %s",
    (line) => {
      expect(passes("A fix (#158)", "", [], [`A fix\n${line}`])).toBe(true);
    }
  );

  // #213's first line told #211's story, naming #209, and its commit's quote
  // of "Fix #209" closed #209 a second time.
  it("refuses one whose first line names the issue without closing it", () => {
    const first = "#211's evidence said Fix + #209, and GitHub shut #209.";
    const message = 'A change\nQuoting #211: "Fix #209 before #145."';
    expect(closes("A change", first, [], [message])).toContain(
      "merging it closes #209,"
    );
  });

  it("reads a PR with no body", () => {
    expect(passes("A fix (#158)", "", [158])).toBe(true);
  });

  it("tells #20 from #209", () => {
    expect(
      closes("A fix (#20)", "Closes #20.\nFix #209.", [20, 209])
    ).toContain("closes #209,");
  });
});
