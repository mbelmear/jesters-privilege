// Names each test that passed using most of its time (src/lib/near-timeout.ts),
// as a ::warning:: on a pull request. Nightly sets NEAR_TIMEOUT_FAILS, so there
// it's an ::error:: that fails the run, and the failure report files it (#199).
import path from "node:path";
import type {
  FullConfig,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import { nearTimeout, nearTimeoutLine } from "../src/lib/near-timeout";

export default class NearTimeoutReporter implements Reporter {
  private root = "";
  private lines: string[] = [];

  onBegin(config: FullConfig) {
    this.root = path.dirname(config.configFile ?? process.cwd());
  }

  onTestEnd(test: TestCase, result: TestResult) {
    // Playwright sets test.timeout to the test's own, after test.setTimeout.
    const attempt = { status: result.status, duration: result.duration };
    if (!nearTimeout({ ...attempt, timeout: test.timeout })) return;
    this.lines.push(
      nearTimeoutLine({
        ...attempt,
        timeout: test.timeout,
        project: test.parent.project()?.name ?? "",
        file: path.relative(this.root, test.location.file),
        line: test.location.line,
        column: test.location.column,
        // Past the root, project and file suites.
        titles: test.titlePath().slice(3),
      })
    );
  }

  async onEnd() {
    const fails = Boolean(process.env.NEAR_TIMEOUT_FAILS);
    for (const line of this.lines) {
      console.log(`::${fails ? "error" : "warning"}::${line}`);
    }
    if (fails && this.lines.length) return { status: "failed" as const };
  }

  printsToStdio() {
    return false;
  }
}
