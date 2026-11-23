// Which actions GitHub lets this repo's workflows use. Settings → Actions
// allows only GitHub-owned actions and the patterns listed, and refuses a run
// that uses anything else before any job starts (`startup_failure`, no logs).
// .github/allowed-actions.json mirrors that setting; its test checks every
// `uses:` under .github/ against it (docs/testing.md, In CI).
import { parse } from "yaml";

/** The setting, as `gh api repos/{owner}/{repo}/actions/permissions/selected-actions` gives it. */
export type ActionsPolicy = {
  github_owned_allowed: boolean;
  verified_allowed: boolean;
  patterns_allowed: string[];
};

// GitHub's patterns use * for any run of characters, `/` included.
const matches = (pattern: string, uses: string) =>
  new RegExp(
    `^${pattern
      .split("*")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*")}$`
  ).test(uses);

// The owners whose actions count as GitHub-owned.
const GITHUB_OWNERS = ["actions", "github"];

/**
 * Whether the policy lets a step use `uses`. A local action (`./…`) always
 * runs. A Marketplace-verified one counts as refused: nothing here can tell
 * which creators GitHub has verified.
 */
export function allows(policy: ActionsPolicy, uses: string): boolean {
  if (uses.startsWith("./")) return true;
  const owner = uses.split("/")[0];
  if (policy.github_owned_allowed && GITHUB_OWNERS.includes(owner)) return true;
  return policy.patterns_allowed.some((pattern) => matches(pattern, uses));
}

/** Every `uses:` value in a workflow or composite action's YAML, in order. */
export function usesIn(yaml: string): string[] {
  const found: string[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === "object") {
      const entries: [string, unknown][] = Object.entries(node);
      for (const [key, value] of entries) {
        if (key === "uses" && typeof value === "string") found.push(value);
        else walk(value);
      }
    }
  };
  walk(parse(yaml));
  return found;
}
