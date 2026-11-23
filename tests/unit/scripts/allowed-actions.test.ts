/**
 * @jest-environment node
 */
import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type ActionsPolicy,
  allows,
  usesIn,
} from "../../../scripts/allowed-actions";
import { repoRoot } from "../../paths";

// Made up, in the shape `gh api repos/{owner}/{repo}/actions/permissions/selected-actions` gives.
const policy: ActionsPolicy = {
  github_owned_allowed: true,
  verified_allowed: false,
  patterns_allowed: ["rhysd/actionlint@*", "docker://rhysd/actionlint:*"],
};

describe("allows", () => {
  it.each([
    "./.github/actions/setup",
    "actions/checkout@v5",
    "github/codeql-action/init@v4",
    "rhysd/actionlint@v1.7.12",
    "docker://rhysd/actionlint:1.7.12",
  ])("allows %s", (uses) => {
    expect(allows(policy, uses)).toBe(true);
  });

  // #281's first CI run died with startup_failure on the docker:// step,
  // which rhysd/actionlint@* alone doesn't cover.
  it.each([
    [
      "a docker image only an action pattern names",
      {
        ...policy,
        patterns_allowed: ["rhysd/actionlint@*"],
      },
      "docker://rhysd/actionlint:1.7.12",
    ],
    ["a third-party action", policy, "dorny/paths-filter@v3"],
    [
      "a GitHub-owned action when GitHub-owned aren't allowed",
      { ...policy, github_owned_allowed: false },
      "actions/checkout@v5",
    ],
    [
      "an action whose owner only starts like a GitHub one",
      policy,
      "actions-rs/toolchain@v1",
    ],
    [
      "a Marketplace-verified action, which no file can tell apart",
      { ...policy, verified_allowed: true },
      "docker/build-push-action@v6",
    ],
  ])("refuses %s", (_case, given, uses) => {
    expect(allows(given, uses)).toBe(false);
  });

  it("reads * in a pattern as any run of characters", () => {
    const wide = { ...policy, patterns_allowed: ["octo-org/*"] };

    expect(allows(wide, "octo-org/deploy/sub@v2")).toBe(true);
    expect(allows(wide, "octo-orgs/deploy@v2")).toBe(false);
  });
});

describe("usesIn", () => {
  it("lists every uses: in a workflow's jobs and a composite action's steps", () => {
    const workflow = `
jobs:
  lint:
    steps:
      - uses: actions/checkout@v5 # zizmor: ignore[artipacked]
      - run: echo hi
      - uses: "docker://rhysd/actionlint:1.7.12"
  shared:
    uses: octo-org/workflows/.github/workflows/ci.yml@main
`;
    const composite = `
runs:
  using: composite
  steps:
    - uses: actions/setup-node@v5
`;

    expect(usesIn(workflow)).toEqual([
      "actions/checkout@v5",
      "docker://rhysd/actionlint:1.7.12",
      "octo-org/workflows/.github/workflows/ci.yml@main",
    ]);
    expect(usesIn(composite)).toEqual(["actions/setup-node@v5"]);
  });
});

// GitHub refuses a run whose workflow uses an action its allowlist doesn't
// cover, before any job starts, so this test fails in the commit hook first:
// CI never reaches it. .github/allowed-actions.json mirrors the setting, and a
// SessionStart hook says when they differ (scripts/allowed-actions-drift.sh).
describe("this repo's workflows and actions", () => {
  const checkedIn = JSON.parse(
    readFileSync(join(repoRoot, ".github/allowed-actions.json"), "utf8")
  ) as ActionsPolicy;
  const files = globSync(
    ".github/{workflows/*.{yml,yaml},actions/*/action.{yml,yaml}}",
    { cwd: repoRoot }
  );

  it("finds the workflows and actions", () => {
    expect(files).toEqual(
      expect.arrayContaining([
        ".github/workflows/ci.yml",
        ".github/actions/setup/action.yml",
      ])
    );
  });

  it("uses only what .github/allowed-actions.json allows", () => {
    const refused = files.flatMap((file) =>
      usesIn(readFileSync(join(repoRoot, file), "utf8"))
        .filter((uses) => !allows(checkedIn, uses))
        .map(
          (uses) =>
            `${file}: ${uses}. Add a pattern to GitHub's allowlist and to .github/allowed-actions.json in this PR (docs/testing.md, In CI).`
        )
    );

    expect(refused).toEqual([]);
  });
});
