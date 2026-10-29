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
