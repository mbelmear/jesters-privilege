import { waitForServer } from "./wait-for-server";

const URL = "http://localhost:4000/no-such-page";
const noWait = async () => {};

describe("waitForServer", () => {
  it("is ready once the page answers, even with the 404 page", async () => {
    const answers = [
      () => Promise.reject(new Error("ECONNREFUSED")),
      () => Promise.resolve({ ok: false, status: 404 }),
    ];
    let calls = 0;
    await expect(
      waitForServer(URL, {
        fetch: () => answers[calls++](),
        sleep: noWait,
      })
    ).resolves.toBeUndefined();
    expect(calls).toBe(2);
  });

  it("fails, naming the page, when the server never answers", async () => {
    await expect(
      waitForServer(URL, {
        fetch: () => Promise.reject(new Error("ECONNREFUSED")),
        sleep: noWait,
      })
    ).rejects.toThrow(
      `The built site didn't serve ${URL}; run npm run build first`
    );
  });
});
