// Warns when a pull request removes a browser test, so a rename or a removal
// is one its author meant and its reviewer sees. It warns rather than fails,
// since either can be right. The logic is src/lib/dropped-tests.ts. The base's
// specs read out/, so build first.
// Usage: npm run dropped-tests -- [base-ref] (default: where HEAD left origin/main)
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { droppedTests } from "@/lib/dropped-tests";

const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();

// Every test `cwd` has, those for the empty-feed build (`FEED=empty`) included.
function listing(cwd: string): string {
  const list = (env: Record<string, string | undefined>) =>
    execFileSync("npx", ["playwright", "test", "--list"], {
      cwd,
      env: { ...process.env, ...env },
      encoding: "utf8",
      maxBuffer: 1 << 26,
    });
  return list({ FEED: undefined }) + list({ FEED: "empty" });
}

const base = process.argv[2] ?? git("merge-base", "HEAD", "origin/main");
const checkout = join(mkdtempSync(join(tmpdir(), "dropped-tests-")), "base");
git("worktree", "add", "--quiet", "--detach", checkout, base);
try {
  for (const shared of ["node_modules", "out"]) {
    symlinkSync(resolve(shared), join(checkout, shared));
  }
  const dropped = droppedTests(listing(checkout), listing("."));
  for (const test of dropped) {
    console.log(
      `::warning::This pull request removes or renames a browser test: ${test}`
    );
  }
  console.log(`Browser tests dropped since ${base}: ${dropped.length}`);
} finally {
  git("worktree", "remove", "--force", checkout);
  rmSync(join(checkout, ".."), { recursive: true, force: true });
}
