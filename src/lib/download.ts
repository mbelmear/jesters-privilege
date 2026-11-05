// The part of a fetch Response that downloading text needs, so tests and the
// fixture can stand in for the network.
export type TextResponse = Pick<
  Response,
  "ok" | "status" | "statusText" | "text"
>;
// What a request sends besides its URL: the token request to Spotify posts a
// form, and its lookup carries the token. Every other download is a plain GET.
export type FetchInit = {
  method?: "POST";
  headers?: Record<string, string>;
  body?: string;
};
export type Fetch = (url: string, init?: FetchInit) => Promise<TextResponse>;

// What the build and the feed check download, named in their errors.
export type Download =
  | "Feed"
  | "Transcript"
  | "Build manifest"
  | "Apple Podcasts lookup"
  | "Spotify token"
  | "Spotify lookup";

// The body at `url`, or an error naming `what` was being fetched and why it
// failed.
export async function downloadText(
  what: Download,
  url: string,
  fetch: Fetch,
  init?: FetchInit
): Promise<string> {
  let response: TextResponse;
  try {
    response = await fetch(url, init);
  } catch (error: unknown) {
    throw new Error(
      `${what} ${url} couldn't be reached: ${errorMessage(error)}`
    );
  }
  if (!response.ok) {
    throw new Error(
      `${what} ${url} answered ${response.status} ${response.statusText}`
    );
  }
  return response.text();
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
