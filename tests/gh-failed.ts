// What execFileSync throws when gh exits non-zero, for a test whose fake
// gh fails. Its message names the command, then adds stderr if there was
// any; `status` is gh's exit code, which the PR gate reads (ghExit in
// scripts/pr-gate-github.ts) to know gh said its own error. The shape was
// recorded from Node 24.22.1 on 2026-11-20; the values a test passes say
// beside them whether gh gave them or they are made up.
// A hand-built `new Error("Command failed: …")` lint fails in a test
// (eslint.config.mjs): #268's lacked `status`, so pinned less than it said.

export type GhFailure = {
  /** The command as execFileSync's message names it, e.g. "gh pr view 7". */
  command: string;
  status: number;
  stderr?: string;
  stdout?: string;
};

export const ghFailed = ({
  command,
  status,
  stderr = "",
  stdout = "",
}: GhFailure) =>
  Object.assign(
    new Error(`Command failed: ${command}${stderr ? `\n${stderr}` : ""}`),
    { status, stderr, stdout }
  );
