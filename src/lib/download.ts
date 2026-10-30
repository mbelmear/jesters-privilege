// The part of a fetch Response that downloading text needs, so tests and the
// fixture can stand in for the network.
export type TextResponse = Pick<
  Response,
  "ok" | "status" | "statusText" | "text"
>;
export type Fetch = (url: string) => Promise<TextResponse>;

// The body at `url`, or an error naming `what` was being fetched and why it
// failed.
export async function downloadText(
  what: string,
  url: string,
  fetch: Fetch
): Promise<string> {
  let response: TextResponse;
  try {
    response = await fetch(url);
  } catch (error: unknown) {
    throw new Error(`${what} ${url} couldn't be reached: ${reason(error)}`);
  }
  if (!response.ok) {
    throw new Error(
      `${what} ${url} answered ${response.status} ${response.statusText}`
    );
  }
  return response.text();
}

export function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
