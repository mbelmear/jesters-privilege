/**
 * @jest-environment node
 */
import { readFileSync } from "node:fs";
import { FEED_CHECK_INPUT, FEED_CHECK_RUN_NAME } from "@/lib/feed-check-start";

// The Worker, the backstop and the Deploy report name the same input and
// run-name the workflows do (ADR 0004); a rename on one side alone would
// leave the backstop failing, or the Worker's runs deploying unchecked.
const deploy = readFileSync(".github/workflows/deploy.yml", "utf8");
const transcribe = readFileSync(".github/workflows/transcribe.yml", "utf8");
const report = readFileSync(".github/workflows/deploy-report.yml", "utf8");

describe("Deploy's feed check started by the Worker", () => {
  it("declares the input the Worker sends", () => {
    expect(deploy).toMatch(
      new RegExp(
        `workflow_dispatch:\\n {4}inputs:\\n {6}${FEED_CHECK_INPUT}:\\n`
      )
    );
  });

  it("names a run with that input as the backstop looks for it", () => {
    expect(deploy).toContain(
      `run-name: \${{ inputs.${FEED_CHECK_INPUT} && '${FEED_CHECK_RUN_NAME}' || '' }}`
    );
  });

  it("closes the feed check's issue when one of the Worker's passes", () => {
    expect(report).toContain(
      `github.event.workflow_run.display_title == '${FEED_CHECK_RUN_NAME}'`
    );
  });
});

describe("Transcribe started by Deploy's feed check", () => {
  it("is started with the input saying it isn't the Run workflow button", () => {
    expect(deploy).toContain(
      "gh workflow run transcribe.yml --ref main -f from-feed-check=true"
    );
    expect(transcribe).toMatch(
      /workflow_dispatch:\n {4}inputs:\n {6}from-feed-check:\n/
    );
  });

  // Transcribe's plan transcribes an Episode older than a week only when the
  // run was started by hand (#240).
  it("still refuses an Episode older than a week", () => {
    expect(transcribe).toContain(
      "TRANSCRIBE_ANY_AGE: ${{ github.event_name == 'workflow_dispatch' && !inputs.from-feed-check }}"
    );
  });
});
