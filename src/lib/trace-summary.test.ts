/**
 * @jest-environment node
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { summariseTrace, type TraceFile } from "./trace-summary";

// A failing test's trace, cut down from CI run 41005625683's and from real
// traces of a page error and a test timeout. Times are round so each row below
// can be worked out by eye: the earliest context began at 1000.
const folder = join(process.cwd(), "scripts", "trace-fixture");
const fixture: TraceFile[] = readdirSync(folder).map((name) => ({
  name,
  text: readFileSync(join(folder, name), "utf8"),
}));

const rows = (files: TraceFile[] = fixture) =>
  summariseTrace(files, "/frames").split("\n");

describe("summariseTrace", () => {
  it("prints each step and page action with its start and end", () => {
    expect(rows()).toContain(
      "   100 -    500  step        Navigate /styleguide"
    );
  });

  it("nests a step under its parent", () => {
    expect(rows()).toContain('    20 -     30  step          Fixture "page"');
  });

  it("names an action only the browser's half of the trace holds", () => {
    expect(rows()).toContain(
      "   700 -    750  step        BrowserContext.newPage"
    );
  });

  it("shows one row for an action both halves of the trace hold", () => {
    expect(rows().filter((row) => row.includes("Navigate"))).toHaveLength(1);
    expect(rows().join("\n")).not.toContain("Frame.goto");
  });

  it("leaves out Playwright's configuration fixtures", () => {
    expect(rows().join("\n")).not.toContain("viewport");
  });

  it("says when an action never finished", () => {
    expect(rows()).toContain(
      "  1000 -    ...  step        Click getByRole('button', { name: 'Replay' }) (did not finish)"
    );
  });

  it("gives a step's error on its row, without colour codes", () => {
    expect(rows()).toContain(
      '   610 -    620  step          Expect "toBe" error: Error: expect(received).toBe(expected) | Expected: 0 | Received: -471'
    );
  });

  it("orders the timeline by start time, across files", () => {
    const starts = rows()
      .filter((row) => /^ *\d+ /.test(row))
      .map((row) => Number.parseInt(row, 10));
    expect(starts.length).toBeGreaterThan(5);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it("explains the marked times", () => {
    expect(rows()[1]).toContain("A time marked > is a lower bound");
  });

  it("names the test and the browser it ran in", () => {
    expect(rows()[0]).toBe(
      "styleguide.spec.ts:82 › Reduced motion › Motion animations finish at once (webkit, 1280x720)"
    );
  });

  it("prints console messages with their level and where they came from", () => {
    expect(rows()).toContain(
      "   460           console     error: Failed to load resource: the server responded with a status of 404 (Not Found) (http://localhost:4173/episodes)"
    );
    expect(rows()).toContain(
      "   470           console     log: hello 1 (http://localhost:4173/)"
    );
  });

  it("prints page errors, named when the page threw an Error", () => {
    expect(rows()).toContain("   480           page error  TypeError: boom");
    expect(rows()).toContain("   490           page error  plain");
  });

  it("marks an error of the test's own as no earlier than the line before it", () => {
    expect(rows()).toContain(
      " >1000           test error  Test timeout of 30000ms exceeded."
    );
  });

  it("prints requests that failed with a status of 400 or more", () => {
    expect(rows()).toContain(
      "   450           request     404 GET http://localhost:4173/episodes"
    );
    expect(rows().join("\n")).not.toContain("request     200");
  });

  it("leaves out a request that got no status, which the console reports", () => {
    expect(rows().join("\n")).not.toContain("request     -1");
  });

  it("prints each screencast frame with its image and the gap since the last", () => {
    expect(rows()).toContain(
      "   200           frame       /frames/screencast/page@1-100.jpeg"
    );
    expect(rows()).toContain(
      "   300           frame       /frames/screencast/page@1-200.jpeg (+100 ms)"
    );
    expect(rows()).toContain(
      "  1193           frame       /frames/screencast/page@1-1100.jpeg (+893 ms)"
    );
  });

  it("measures each page's frame gaps separately", () => {
    const frame = (page: string, timestamp: number) =>
      JSON.stringify({
        type: "screencast-frame",
        pageId: page,
        file: `screencast/${page}-${timestamp}.jpeg`,
        timestamp,
      });
    const output = rows([
      {
        name: "1-trace.trace",
        text: [
          '{"type":"context-options","monotonicTime":0,"browserName":"webkit"}',
          frame("a", 10),
          frame("b", 20),
          frame("a", 50),
        ].join("\n"),
      },
    ]);
    expect(output).toContain(
      "    20           frame       /frames/screencast/b-20.jpeg"
    );
    expect(output).toContain(
      "    50           frame       /frames/screencast/a-50.jpeg (+40 ms)"
    );
  });

  it("says so when the test opened no browser, as then nothing names it", () => {
    const output = rows([
      {
        name: "test.trace",
        text: '{"type":"context-options","origin":"testRunner","browserName":"","options":{},"monotonicTime":0}',
      },
    ]);
    expect(output[0]).toBe(
      "This trace names no test: the test opened no browser."
    );
  });

  it("refuses a viewport with no height", () => {
    expect(() =>
      rows([
        {
          name: "1-trace.trace",
          text: '{"type":"context-options","browserName":"webkit","options":{"viewport":{"width":1280}},"monotonicTime":0}',
        },
      ])
    ).toThrow("1-trace.trace:1 has no number at height");
  });

  it("refuses a line that isn't JSON, naming it", () => {
    expect(() =>
      rows([{ name: "1-trace.trace", text: "{}\nnot json" }])
    ).toThrow("1-trace.trace:2 is not JSON");
  });

  it("refuses an event missing a field it needs, naming the line", () => {
    expect(() =>
      rows([
        {
          name: "1-trace.trace",
          text: '{"type":"context-options","monotonicTime":0,"browserName":""}\n{"type":"screencast-frame","pageId":"a","timestamp":10}',
        },
      ])
    ).toThrow("1-trace.trace:2 has no string at file");
  });

  it("refuses an action that ends without beginning", () => {
    expect(() =>
      rows([
        {
          name: "test.trace",
          text: '{"type":"context-options","monotonicTime":0,"browserName":""}\n{"type":"after","callId":"a@9","endTime":1}',
        },
      ])
    ).toThrow("test.trace:2 ends a@9, which never began");
  });

  it("refuses files with no trace in them", () => {
    expect(() => rows([])).toThrow("No context-options line");
  });
});
