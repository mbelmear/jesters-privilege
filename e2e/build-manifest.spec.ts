import { expect, test } from "@playwright/test";
import {
  BUILD_MANIFEST_PATH,
  parseBuildManifest,
} from "../src/lib/build-manifest";

test("the built site publishes its build manifest", async ({ request }) => {
  const response = await request.get(BUILD_MANIFEST_PATH);
  expect(response.ok()).toBe(true);

  const body: unknown = await response.json();
  expect(() => parseBuildManifest(body)).not.toThrow();
});

test("records the Episodes that had Episode Listen links", async ({
  request,
}) => {
  const manifest = parseBuildManifest(
    await (await request.get(BUILD_MANIFEST_PATH)).json()
  );
  // The fixture's Apple lookup lists all but its newest Episode and trailer.
  expect(manifest.episodeListenLinks).toEqual({
    "apple-podcasts": [
      "https://api.spreaker.com/episode/70000005",
      "https://api.spreaker.com/episode/70000004",
      "https://api.spreaker.com/episode/70000003",
      "https://api.spreaker.com/episode/70000002",
    ],
  });
});
