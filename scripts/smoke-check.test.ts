/**
 * @jest-environment node
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(__dirname, "smoke-check.sh");
const COMMIT = "abc1234";

const HEALTHY = {
  STUB_MANIFEST: `{"newestEpisodeGuid":null,"commit":"${COMMIT}"}`,
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
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function smokeCheck(production: Partial<typeof HEALTHY> = {}) {
  return spawnSync("bash", [script, COMMIT], {
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
    expect(result.stderr).toContain("Smoke check failed: manifest_has_commit");
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
