// Waits for the static server that serves the built site in out/ to come up,
// for scripts/screenshots.ts. Any answer means it is up: a missing page
// answers with the 404 page, which is worth a screenshot too.
export type WaitIO = {
  fetch: (url: string) => Promise<{ ok: boolean; status: number }>;
  sleep: (ms: number) => Promise<void>;
};

export async function waitForServer(url: string, io: WaitIO): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const answered = await io.fetch(url).then(
      () => true,
      () => false
    );
    if (answered) return;
    await io.sleep(200);
  }
  throw new Error(
    `The built site didn't serve ${url}; run npm run build first`
  );
}
