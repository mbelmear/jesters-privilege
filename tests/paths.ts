// Where the code under test lives, for tests that read or run files by path.
// Tests sit in tests/, apart from the code, so a test never builds a path from
// its own directory.
import { join } from "node:path";

export const repoRoot = join(__dirname, "..");
export const srcDir = join(repoRoot, "src");
export const scriptsDir = join(repoRoot, "scripts");
