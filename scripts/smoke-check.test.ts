/**
 * @jest-environment node
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(__dirname, "smoke-check.sh");
const COMMIT = "abc1234";
const BUILT_MANIFEST = `{"newestEpisodeGuid":"episode-2","commit":"${COMMIT}"}`;

const HEALTHY = {
  STUB_MANIFEST: BUILT_MANIFEST,
  STUB_HOME: `<h1>Hi</h1><script src="https://static.cloudflareinsights.com/beacon.min.js"></script>`,
  STUB_WWW: "301 https://jestersprivilegepodcast.com/about?x=1",
  STUB_HTTP: "301 https://jestersprivilegepodcast.com/x?y=1",
  // How many calls answer with STUB_STALE_MANIFEST before the deploy arrives.
  STUB_STALE_CALLS: "0",
};

// Stands in for production: answers only the exact addresses the script should
// ask for, so a check that asks for the wrong one fails.
const CURL = `#!/usr/bin/env bash
url="\${*: -1}"
case "$url" in
  https://jestersprivilegepodcast.com/build-manifest.json)
    calls=$(cat "$STUB_DIR/calls" 2>/dev/null || echo 0)
    echo $((calls + 1)) > "$STUB_DIR/calls"
    if ((calls < STUB_STALE_CALLS)); then
      printf '{"commit":"previous"}'
    else
      printf '%s' "$STUB_MANIFEST"
    fi
    ;;
  https://jestersprivilegepodcast.com/) printf '%s' "$STUB_HOME" ;;
  "https://www.jestersprivilegepodcast.com/about?x=1") printf '%s' "$STUB_WWW" ;;
  "http://jestersprivilegepodcast.com/x?y=1") printf '%s' "$STUB_HTTP" ;;
  *) printf '000 ' ;;
esac
`;

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "smoke-check-"));
  writeFileSync(join(dir, "curl"), CURL, { mode: 0o755 });
  // The retries' waits add up to a minute.
  writeFileSync(join(dir, "sleep"), "#!/usr/bin/env bash\n", { mode: 0o755 });
  mkdirSync(join(dir, "out"));
  writeFileSync(join(dir, "out", "build-manifest.json"), BUILT_MANIFEST);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function smokeCheck(production: Partial<typeof HEALTHY> = {}) {
  return spawnSync("bash", [script, COMMIT], {
    cwd: dir,
    encoding: "utf8",
    env: {
      ...process.env,
      ...HEALTHY,
      ...production,
      STUB_DIR: dir,
      PATH: `${dir}:${process.env.PATH ?? ""}`,
    },
  });
}

describe("smoke-check", () => {
  it("passes when production serves the deploy", () => {
    const result = smokeCheck();
    expect(result.stdout).toContain(`Production is serving ${COMMIT}`);
    expect(result.status).toBe(0);
  });

  it("waits for the deploy to reach Cloudflare", () => {
    expect(smokeCheck({ STUB_STALE_CALLS: "11" }).status).toBe(0);
  });

  it("gives up after a minute of the previous deploy", () => {
    const result = smokeCheck({ STUB_STALE_CALLS: "12" });
    expect(result.stderr).toContain(
      "Smoke check failed: live_manifest_matches_build"
    );
    expect(result.status).toBe(1);
  });

  // A deploy the feed check started rebuilds the commit already live.
  it("fails when production still names the previous newest Episode", () => {
    const result = smokeCheck({
      STUB_MANIFEST: `{"newestEpisodeGuid":"episode-1","commit":"${COMMIT}"}`,
    });
    expect(result.stderr).toContain(
      "Smoke check failed: live_manifest_matches_build"
    );
    expect(result.status).toBe(1);
  });

  it("fails at once when the build doesn't name the commit", () => {
    writeFileSync(
      join(dir, "out", "build-manifest.json"),
      '{"newestEpisodeGuid":"episode-2","commit":null}'
    );
    const result = smokeCheck({
      STUB_MANIFEST: '{"newestEpisodeGuid":"episode-2","commit":null}',
    });
    expect(result.stderr).toContain(
      "Smoke check failed: built_manifest_names_commit"
    );
    expect(result.status).toBe(1);
  });

  it("fails at once when there is no built manifest", () => {
    rmSync(join(dir, "out", "build-manifest.json"));
    const result = smokeCheck();
    expect(result.stderr).toContain(
      "Smoke check failed: built_manifest_names_commit"
    );
    expect(result.status).toBe(1);
  });

  it.each([
    [
      "home_page_serves",
      { STUB_HOME: "static.cloudflareinsights.com/beacon.min.js" },
    ],
    ["home_page_counts_visits", { STUB_HOME: "<h1>Hi</h1>" }],
    [
      "www_redirects_to_apex",
      { STUB_WWW: "302 https://jestersprivilegepodcast.com/about?x=1" },
    ],
    [
      "www_redirects_to_apex",
      { STUB_WWW: "301 https://jestersprivilegepodcast.com/about" },
    ],
    ["http_redirects_to_https", { STUB_HTTP: "200 " }],
    [
      "http_redirects_to_https",
      { STUB_HTTP: "302 https://jestersprivilegepodcast.com/x?y=1" },
    ],
    [
      "http_redirects_to_https",
      { STUB_HTTP: "301 https://jestersprivilegepodcast.com/" },
    ],
  ])("fails naming %s for %j", (check, production) => {
    const result = smokeCheck(production);
    expect(result.stderr).toContain(`Smoke check failed: ${check}`);
    expect(result.status).toBe(1);
  });
});
