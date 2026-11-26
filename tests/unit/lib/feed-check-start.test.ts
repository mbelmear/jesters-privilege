import {
  FEED_CHECK_RUN_NAME,
  checkFeedChecksStarted,
} from "@/lib/feed-check-start";

const NOW = new Date("2026-11-26T15:00:00Z");

// Recorded 2026-11-26: `gh run list --workflow deploy.yml --event
// workflow_dispatch --json createdAt,displayTitle` for two Run workflow
// button runs, which take the workflow's name.
const BUTTON_RUNS = [
  { createdAt: "2026-11-25T21:55:39Z", displayTitle: "Deploy" },
  { createdAt: "2026-11-25T16:24:30Z", displayTitle: "Deploy" },
];

// Made up in the same format: runs the Worker started, which carry Deploy's
// run-name for them.
const workerRun = (createdAt: string) => ({
  createdAt,
  displayTitle: FEED_CHECK_RUN_NAME,
});

function check(runs: unknown) {
  const log: string[] = [];
  const code = checkFeedChecksStarted(JSON.stringify(runs), NOW, (line) =>
    log.push(line)
  );
  return { code, log };
}

describe("checkFeedChecksStarted", () => {
  it("passes when the Worker started a feed check in the last 3 hours", () => {
    expect(
      check([
        workerRun("2026-11-26T14:00:04Z"),
        workerRun("2026-11-26T13:00:03Z"),
        ...BUTTON_RUNS,
      ])
    ).toEqual({
      code: 0,
      log: [
        "::notice::The Worker started a feed check at 2026-11-26T14:00:04Z, within the last 3 hours",
      ],
    });
  });

  it("fails, naming the newest, when the Worker's feed checks are older than 3 hours", () => {
    expect(
      check([
        { createdAt: "2026-11-26T14:40:00Z", displayTitle: "Deploy" },
        workerRun("2026-11-26T11:59:59Z"),
      ])
    ).toEqual({
      code: 1,
      log: [
        "::error::No feed check started by the Worker has run in the last 3 hours (the newest was at 2026-11-26T11:59:59Z), so a new Episode waits for GitHub's schedule. Check the Worker's Cron Trigger and its DEPLOY_DISPATCH_TOKEN (docs/deploy.md, Triggers).",
      ],
    });
  });

  it("fails when no run the Worker started is listed, however recent the button's", () => {
    expect(
      check([
        { createdAt: "2026-11-26T14:50:00Z", displayTitle: "Deploy" },
        ...BUTTON_RUNS,
      ])
    ).toEqual({
      code: 1,
      log: [
        "::error::No feed check started by the Worker has run in the last 3 hours (none of the 3 newest dispatched Deploy runs is one), so a new Episode waits for GitHub's schedule. Check the Worker's Cron Trigger and its DEPLOY_DISPATCH_TOKEN (docs/deploy.md, Triggers).",
      ],
    });
  });

  it.each([
    ["isn't JSON", "not json", "isn't JSON"],
    ["isn't a list", "{}", "isn't a list"],
    [
      "lists a run without a start time",
      JSON.stringify([{ displayTitle: "Deploy" }]),
      "has a run without createdAt and displayTitle",
    ],
    [
      "lists a run whose start time isn't a date",
      JSON.stringify([{ createdAt: "soon", displayTitle: "Deploy" }]),
      'has a run created at "soon", which isn\'t a date',
    ],
  ])("throws when gh's list %s", (_case, text, message) => {
    expect(() => checkFeedChecksStarted(text, NOW, () => {})).toThrow(
      `gh's list of Deploy runs ${message}`
    );
  });
});
