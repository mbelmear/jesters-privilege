// Compares two folders of screenshots from `npm run screenshots`, a visual
// change's before and after: for each PNG, whether it's the same, the
// rectangle (in the image's pixels) that changed, or a change of size. A
// file in only one folder is named too. Usage:
//   npm run screenshots:compare -- <before folder> <after folder>
// Take "before" in a worktree at origin/main, before changing anything.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { PNG } from "pngjs";
import { compareImages, describeDifference } from "../src/lib/screenshot-diff";

const [beforeDir, afterDir] = process.argv.slice(2);
if (!beforeDir || !afterDir) {
  console.error(
    "Usage: npm run screenshots:compare -- <before folder> <after folder>"
  );
  process.exit(2);
}

const pngs = async (dir: string) =>
  (await readdir(dir)).filter((name) => name.endsWith(".png")).sort();
const decode = async (path: string) => PNG.sync.read(await readFile(path));

async function main(beforeDir: string, afterDir: string) {
  const before = await pngs(beforeDir);
  const after = new Set(await pngs(afterDir));
  for (const name of before) {
    if (!after.has(name)) {
      console.log(`missing  ${name}  (only before)`);
      continue;
    }
    after.delete(name);
    const [a, b] = await Promise.all([
      decode(join(beforeDir, name)),
      decode(join(afterDir, name)),
    ]);
    console.log(describeDifference(name, compareImages(a, b)));
  }
  for (const name of after) console.log(`new      ${name}  (only after)`);
}

main(beforeDir, afterDir).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
