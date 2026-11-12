/**
 * @jest-environment node
 */
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const script = join(__dirname, "closing-issues.sh");

// A stand-in gh that answers `gh pr view` from a fixture, filtered by the
// caller's own --jq through the real jq. gh's --jq is gojq, whose regexes
// have no lookahead where jq's do, so the filter keeps to what both read.
function pr(
  title: string,
  body: string | null,
  closes: number[],
  commitMessages: string[] = []
) {
  const root = mkdtempSync(join(tmpdir(), "closing-issues-"));
  const fixture = join(root, "pr.json");
  writeFileSync(
    fixture,
    JSON.stringify({
      title,
      body,
      // Each as `gh pr view 211 --json closingIssuesReferences` answered on
      // 12 November 2026.
      closingIssuesReferences: closes.map((number) => ({
        id: "I_kwDOVZ_PPc8AAAABed5_xA",
        number,
        repository: {
          id: "R_kgDOVZ_PPQ",
          name: "jesters-privilege",
          owner: { id: "MDQ6VXNlcjkwMDA4MDU1", login: "mbelmear" },
        },
        url: `https://github.com/mbelmear/jesters-privilege/issues/${number}`,
      })),
      // Shaped as `gh pr view 213 --json commits` answered on 12 November
      // 2026, which splits each message at its first line.
      commits: commitMessages.map((message, i) => ({
        authoredDate: "2026-11-12T01:03:03Z",
        authors: [
          {
            email: "jester@example.com",
            id: "MDQ6VXNlcjkwMDA4MDU1",
            login: "jester",
            name: "A Jester",
          },
        ],
        committedDate: "2026-11-12T01:03:03Z",
        messageBody: message.split("\n").slice(2).join("\n"),
        messageHeadline: message.split("\n")[0],
        oid: String(i).padStart(40, "0"),
      })),
    })
  );
  writeFileSync(
    join(root, "gh"),
    `#!/bin/bash
filter="."
while (($#)); do
  [[ $1 == --jq ]] && { filter=$2; shift; }
  shift
done
jq -r "$filter" "${fixture}"
`
  );
  chmodSync(join(root, "gh"), 0o755);
  const result = spawnSync("bash", [script, "211", "merge"], {
    env: { ...process.env, PATH: `${root}${delimiter}${process.env.PATH}` },
    encoding: "utf8",
  });
  rmSync(root, { recursive: true, force: true });
  return result;
}

describe("closing-issues.sh", () => {
  it("passes a PR that closes only the issue its title names", () => {
    expect(pr("A fix (#158)", "Closes #158.\n\nMore.", [158]).status).toBe(0);
  });

  it("passes one that closes issues its body's first line names", () => {
    // #202's first line, the retro of #188 and #196.
    const first =
      "Part of the retro of #188 and #196. Closes #181, closes #200.";
    expect(pr("Retro of #188 and #196", first, [181, 200]).status).toBe(0);
  });

  it("passes one that closes nothing", () => {
    expect(pr("Retro of #158", "Fix #209 before #145.", []).status).toBe(0);
  });

  // #211 said "Fix #209 before #145." in its evidence, and GitHub closed #209
  // when it merged.
  it("refuses one that would close an issue named only further down", () => {
    const body = "Closes #158.\n\n- Fix #209 before #145.";
    const result = pr("A fix (#158)", body, [158, 209]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Refusing to merge #211: merging it closes #209"
    );
    expect(result.stderr).not.toContain("#158");
  });

  // The squash merge's body is the PR's commit messages, and GitHub closes
  // what they name too: #213's quoted #211's line and closed #209 again.
  it("refuses a commit message that would close an issue the PR doesn't name", () => {
    const message =
      "merge refuses a PR that would close an unnamed issue\n\n" +
      `#211's evidence said "Fix #209 before #145.", and GitHub closed it.`;
    const result = pr("merge refuses (#158)", "From the retro.", [], [message]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("merging it closes #209");
  });

  it("passes a commit message that closes the issue the title names", () => {
    const message = "A fix\n\nCloses #158.";
    expect(pr("A fix (#158)", "", [158], [message]).status).toBe(0);
  });

  it.each(["Fixes: #209", "resolved #209", "CLOSED #209", "fix #209"])(
    "reads GitHub's keyword in %s",
    (line) => {
      expect(pr("A fix (#158)", "", [], [`A fix\n\n${line}`]).status).toBe(1);
    }
  );

  it.each(["prefix #209", "fixing #209", "closer to #209"])(
    "reads no keyword in %s",
    (line) => {
      expect(pr("A fix (#158)", "", [], [`A fix\n\n${line}`]).status).toBe(0);
    }
  );

  // #213's first line told #211's story, naming #209, and its commit's quote
  // of "Fix #209" closed #209 a second time.
  it("refuses one whose first line names the issue without closing it", () => {
    const first = "#211's evidence said Fix + #209, and GitHub shut #209.";
    const message = 'A change\n\nQuoting #211: "Fix #209 before #145."';
    const result = pr("A change", first, [], [message]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("merging it closes #209");
  });

  it("reads a PR with no body", () => {
    expect(pr("A fix (#158)", null, [158]).status).toBe(0);
  });

  it("tells #20 from #209", () => {
    expect(
      pr("A fix (#20)", "Closes #20.\nFix #209.", [20, 209]).stderr
    ).toContain("closes #209");
  });
});
