// The part of a fetch Response that downloading text needs, so tests and the
// fixture can stand in for the network.
export type TextResponse = Pick<
  Response,
  "ok" | "status" | "statusText" | "text"
>;
export type Fetch = (url: string) => Promise<TextResponse>;

// What the build downloads, named in its errors.
export type Download = "Feed" | "Transcript";

// The body at `url`, or an error naming `what` was being fetched and why it
// failed.
export async function downloadText(
  what: Download,
  url: string,
  fetch: Fetch
): Promise<string> {
  let response: TextResponse;
  try {
    response = await fetch(url);
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
