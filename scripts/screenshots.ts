// Screenshots of a page of the built site in out/, for checking a visual
// change: phone and desktop, light and dark, each the full page after
// scrolling through it (so reveals and lazy images have run), plus the
// phone's first screen, where most visitors land from Instagram.
// Build first. Usage: npm run screenshots -- <page path> [folder] [--click <button>]...
//   npm run screenshots -- /styleguide/home .screenshots/home
// Each --click presses the button of that name, in order, then shoots the
// screen as it stands (<size>-<scheme>-clicked.png), for a state that shows
// only after interaction: the player once an Episode plays, a sent form.
//   npm run screenshots -- /episodes/2 --click "Play Episode 2" --click "Show player controls"
// Episode audio is served as silence (e2e/player.ts), so Play really plays.
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";
import { serveEpisodeAudio } from "../e2e/player";

const SIZES = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
  desktop: { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 },
} as const;
const SCHEMES = ["light", "dark"] as const;

async function main() {
  const { positional, clicks } = parseArgs(process.argv.slice(2));
  const [page, folder = ".screenshots"] = positional;
  if (!page?.startsWith("/")) {
    throw new Error(
      'Usage: npm run screenshots -- <page path such as /about> [folder] [--click "<button name>"]...'
    );
  }
  await mkdir(folder, { recursive: true });
  const port = await freePort();
  // serve itself, not through npx, so killing it stops the server. A port the
  // system just handed out is free; other sessions serve their own builds on
  // fixed ports, and serve would quietly move off a busy one.
  const server = spawn(
    join("node_modules", ".bin", "serve"),
    [
      "out",
      "--listen",
      String(port),
      "--no-port-switching",
      "--no-request-logging",
    ],
    { stdio: ["ignore", "ignore", "inherit"] }
  );
  const exited = new Promise<never>((_, reject) => {
    server.on("exit", (code, signal) =>
      reject(
        new Error(`serve stopped (${code ?? signal ?? "?"}) on port ${port}`)
      )
    );
  });
  const browser = await Promise.race([chromium.launch(), exited]).catch(
    (error: unknown) => {
      server.kill();
      throw error;
    }
  );
  try {
    const url = `http://localhost:${port}${page}`;
    await Promise.race([waitForServer(url), exited]);
    for (const [size, options] of Object.entries(SIZES)) {
      for (const colorScheme of SCHEMES) {
        const tab = await browser.newPage({ ...options, colorScheme });
        await serveEpisodeAudio(tab);
        await tab.goto(url);
        // Lazily loaded code (Motion, for an on-scroll reveal) arrives
        // before the scroll that should trigger it.
        await tab.waitForLoadState("networkidle");
        if (size === "phone" && colorScheme === "light") {
          // The first screen's own reveal takes most of a second to rise.
          await tab.waitForTimeout(1200);
          await tab.screenshot({
            path: join(folder, "phone-first-screen.png"),
          });
        }
        await scrollThrough(tab);
        const path = join(folder, `${size}-${colorScheme}.png`);
        await tab.screenshot({ path, fullPage: true });
        console.log(path);
        if (clicks.length > 0) {
          for (const name of clicks) {
            await tab.getByRole("button", { name, exact: true }).click();
            // Lazily loaded UI (the player bar) arrives and settles.
            await tab.waitForTimeout(1500);
          }
          const clicked = join(folder, `${size}-${colorScheme}-clicked.png`);
          await tab.screenshot({ path: clicked });
          console.log(clicked);
        }
        await tab.close();
      }
    }
  } finally {
    server.removeAllListeners("exit");
    server.kill();
    await browser.close();
  }
}

// Splits the arguments into positional ones and the --click button names.
function parseArgs(args: string[]) {
  const positional: string[] = [];
  const clicks: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg !== "--click") {
      positional.push(arg);
      continue;
    }
    const name = args[i + 1];
    if (!name) throw new Error("--click needs a button name");
    clicks.push(name);
    i += 1;
  }
  return { positional, clicks };
}

// Each step pauses long enough for an on-scroll reveal to start.
async function scrollThrough(tab: Page) {
  const height = await tab.evaluate(() => document.body.scrollHeight);
  for (let top = 0; top <= height; top += 400) {
    await tab.evaluate((y) => window.scrollTo(0, y), top);
    await tab.waitForTimeout(200);
  }
  await tab.evaluate(() => window.scrollTo(0, 0));
  await tab.waitForTimeout(1200);
}

// A port nothing is listening on, from the system.
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, () => {
      const address = probe.address();
      probe.close(() =>
        typeof address === "object" && address
          ? resolve(address.port)
          : reject(new Error("The system gave no free port"))
      );
    });
  });
}

async function waitForServer(url: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const ok = await fetch(url).then(
      (response) => response.ok,
      () => false
    );
    if (ok) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(
    `The built site didn't serve ${url}; run npm run build first`
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
