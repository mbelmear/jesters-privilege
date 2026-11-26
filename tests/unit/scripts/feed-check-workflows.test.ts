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

// A job's lines, from its key to the next job's.
function job(name: string): string {
  return (
    new RegExp(`^ {2}${name}:\\n((?: {4}.*\\n|\\n)+)`, "m").exec(deploy)?.[1] ??
    ""
  );
}

describe("Transcribe started by Deploy's feed check", () => {
  it("is started from its own job, so the build's token can't start workflows", () => {
    expect(job("deploy")).not.toBe("");
    expect(job("deploy")).not.toContain("actions: write");
    expect(job("start-transcribe")).toContain("actions: write");
  });

  // The Episode is live once wrangler deploy has shipped it, so the next feed
  // check would find nothing new and never start Transcribe.
  it("starts once the deploy shipped a new Episode, even if the smoke check failed", () => {
    expect(job("start-transcribe")).toContain("needs: [feed-check, deploy]");
    expect(job("start-transcribe")).toMatch(
      /if: >-\n {6}!cancelled\(\) && github\.ref == 'refs\/heads\/main' &&\n {6}needs\.feed-check\.outputs\.new-episode == 'true' &&\n {6}needs\.deploy\.outputs\.shipped == 'true'\n/
    );
  });

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
