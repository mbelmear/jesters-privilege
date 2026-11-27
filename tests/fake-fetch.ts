// A fake fetch for a test of code that calls an outside service over HTTP.
// Every answer is built by recordedResponse() or madeUpResponse(), so it says
// beside it whether the service gave it or it was made up
// (CODING_STANDARDS.md, A fake of an outside service): #302's first review
// found a hand-built GitHub answer with no label, as #264's and #270's did
// for gh. tests/fake-gh.ts does the same for gh.

type Day = `${number}-${number}-${number}`;

// Only recordedResponse() and madeUpResponse() can make one.
declare const labelled: unique symbol;

export type FetchAnswer = {
  readonly response: () => Response;
  readonly source: `recorded ${Day}` | "made up";
  readonly [labelled]: true;
};

// A string is sent as text, anything else as JSON, as the service sends it.
const respond = (body: unknown, init?: ResponseInit) => () =>
  typeof body === "string"
    ? new Response(body, init)
    : Response.json(body, init);

/** What the service answered on that day, copied as it was. Say where from beside it. */
export const recordedResponse = (on: Day, body: unknown, init?: ResponseInit) =>
  ({ response: respond(body, init), source: `recorded ${on}` }) as FetchAnswer;

/** Made up in the service's format: it only feeds the code's own logic. */
export const madeUpResponse = (body: unknown, init?: ResponseInit) =>
  ({ response: respond(body, init), source: "made up" }) as FetchAnswer;

/**
 * Makes globalThis.fetch answer each call with `answer`, and returns the spy,
 * whose mock.calls hold each url and init. Restore it with
 * jest.restoreAllMocks().
 */
export function fakeFetch(
  answer: (url: string, init?: RequestInit) => FetchAnswer
) {
  return jest
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input, init) =>
      answer(
        String(input instanceof Request ? input.url : input),
        init
      ).response()
    );
}
