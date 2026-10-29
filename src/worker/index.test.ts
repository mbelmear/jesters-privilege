/**
 * @jest-environment node
 */
import worker from "./index";

const assets = {
  fetch: async (request: Request) => new Response(`asset ${request.url}`),
};

describe("Worker", () => {
  it("redirects www to the apex domain, keeping the path and query", async () => {
    const response = await worker.fetch(
      new Request("https://www.jestersprivilegepodcast.com/episodes/1?t=90"),
      { ASSETS: assets }
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe(
      "https://jestersprivilegepodcast.com/episodes/1?t=90"
    );
  });

  it("serves the site's files for the apex domain", async () => {
    const response = await worker.fetch(
      new Request("https://jestersprivilegepodcast.com/about"),
      { ASSETS: assets }
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(
      "asset https://jestersprivilegepodcast.com/about"
    );
  });

  it("serves the site's files on a preview URL", async () => {
    const response = await worker.fetch(
      new Request("https://pr-8-jesters-privilege.example.workers.dev/"),
      { ASSETS: assets }
    );

    expect(await response.text()).toBe(
      "asset https://pr-8-jesters-privilege.example.workers.dev/"
    );
  });
});
