// Where the Feed comes from. Until Episode 1 is published, a fixture shaped like
// the Spreaker feed stands in; its Episodes are draft copy.
export type FeedSource =
  { kind: "fixture"; path: string; draft: true } | { kind: "url"; url: string };

export type FeedIO = {
  fetch: (url: string) => Promise<FeedResponse>;
  readFile: (path: string) => Promise<string>;
};

type FeedResponse = Pick<Response, "ok" | "status" | "statusText" | "text">;

// Any failure here fails the build, so the last good deploy stays live (ADR 0001).
export async function loadFeedText(
  source: FeedSource,
  io: FeedIO
): Promise<string> {
  switch (source.kind) {
    case "fixture":
      return io.readFile(source.path);
    case "url":
      return download(source.url, io);
    default: {
      const unhandled: never = source;
      return unhandled;
    }
  }
}

async function download(url: string, io: FeedIO): Promise<string> {
  let response: FeedResponse;
  try {
    response = await io.fetch(url);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Feed ${url} couldn't be reached: ${reason}`);
  }
  if (!response.ok) {
    throw new Error(
      `Feed ${url} answered ${response.status} ${response.statusText}`
    );
  }
  return response.text();
}
