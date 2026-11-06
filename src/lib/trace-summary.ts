// Prints a Playwright trace as one timeline an agent can read, for
// scripts/trace-summary.ts. A trace holds test.trace, written by the test
// runner, and a <n>-trace.trace and <n>-trace.network for each browser context.
// The two halves share a call id for each action and one monotonic clock.
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";

// A text file from the unzipped trace.
export type TraceFile = { name: string; text: string };

type Step = {
  parentId: string | undefined;
  start: number;
  // null when the trace ends with the action still running.
  end: number | null;
  title: string;
  error: string | undefined;
  // A fixture Playwright sets up from the config, such as "viewport".
  configuration: boolean;
};

// A row with one moment rather than a start and an end. `atLeast` means the
// trace gives only a time it can't be earlier than.
type Moment = { time: number; kind: string; text: string; atLeast?: boolean };

type Frame = { time: number; page: string; file: string };

type Line = { where: string; event: unknown };

function field(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  const child: unknown = Reflect.get(value, key);
  return child;
}

function stringAt(line: Line, key: string): string {
  const value = field(line.event, key);
  if (typeof value !== "string") {
    throw new Error(`${line.where} has no string at ${key}`);
  }
  return value;
}

function numberAt(line: Line, key: string): number {
  const value = field(line.event, key);
  if (typeof value !== "number") {
    throw new Error(`${line.where} has no number at ${key}`);
  }
  return value;
}

// The object at `key`, still named after its line for errors about it.
function nested(line: Line, key: string): Line {
  return { where: line.where, event: field(line.event, key) };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readLines(file: TraceFile): Line[] {
  return file.text.split("\n").flatMap((text, index) =>
    text === ""
      ? []
      : [
          {
            where: `${file.name}:${index + 1}`,
            event: parse(text, file, index),
          },
        ]
  );
}

function parse(text: string, file: TraceFile, index: number): unknown {
  try {
    const event: unknown = JSON.parse(text);
    return event;
  } catch {
    throw new Error(`${file.name}:${index + 1} is not JSON`);
  }
}

// Removes colour codes and folds a message onto its row, so grep finds it.
function oneLine(message: string): string {
  return stripVTControlCharacters(message)
    .split("\n")
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .join(" | ");
}

function ms(time: number): string {
  return String(Math.round(time)).padStart(6);
}

const timelineRow = (when: string, kind: string, text: string) =>
  `${when}  ${kind.padEnd(10)}  ${text}`;

// A row with no end time, its columns lined up with a step's.
const momentRow = (when: string, kind: string, text: string) =>
  timelineRow(`${when}         `, kind, text);

function depth(step: Step, steps: Map<string, Step>): number {
  const parent = step.parentId && steps.get(step.parentId);
  return parent ? 1 + depth(parent, steps) : 0;
}

function pageErrorText(line: Line): string {
  const error = nested(nested(nested(line, "params"), "error"), "error");
  const name = stringAt(error, "name");
  const message = oneLine(stringAt(error, "message"));
  return name ? `${name}: ${message}` : message;
}

// Prints the trace's timeline, with each screencast frame's path under
// `imageDir`, where the caller has unzipped the trace.
export function summariseTrace(files: TraceFile[], imageDir: string): string {
  // The runner's half first: its title and times for an action win.
  const ordered = [...files].sort(
    (a, b) => Number(b.name === "test.trace") - Number(a.name === "test.trace")
  );
  const steps = new Map<string, Step>();
  const moments: Moment[] = [];
  const frames: Frame[] = [];
  const beginnings: number[] = [];
  let title: string | undefined;
  let browser = "";
  let viewport = "";

  for (const file of ordered) {
    // An error of the test's own carries no time, and a timeout is written
    // long before its action ends, so all it has is the time of the line
    // before it: a lower bound.
    let clock = 0;
    for (const line of readLines(file)) {
      const type = field(line.event, "type");
      if (type === "context-options") {
        clock = numberAt(line, "monotonicTime");
        beginnings.push(clock);
        title ??= optionalString(field(line.event, "title"));
        browser ||= stringAt(line, "browserName");
        // A context can have no viewport, when a test turns it off.
        const size = nested(nested(line, "options"), "viewport");
        if (size.event) {
          viewport = `${numberAt(size, "width")}x${numberAt(size, "height")}`;
        }
      } else if (type === "before") {
        clock = numberAt(line, "startTime");
        const callId = stringAt(line, "callId");
        if (steps.has(callId)) continue;
        const subtitle = optionalString(field(line.event, "subtitle"));
        const name =
          optionalString(field(line.event, "title")) ??
          `${stringAt(line, "class")}.${stringAt(line, "method")}`;
        steps.set(callId, {
          parentId: optionalString(field(line.event, "parentId")),
          start: clock,
          end: null,
          title: subtitle ? `${name} ${subtitle}` : name,
          error: undefined,
          configuration: field(line.event, "group") === "configuration",
        });
      } else if (type === "after") {
        clock = numberAt(line, "endTime");
        const callId = stringAt(line, "callId");
        const step = steps.get(callId);
        if (!step) {
          throw new Error(`${line.where} ends ${callId}, which never began`);
        }
        step.end ??= clock;
        const message = optionalString(
          field(field(line.event, "error"), "message")
        );
        step.error ??= message && oneLine(message);
      } else if (type === "error") {
        moments.push({
          time: clock,
          kind: "test error",
          atLeast: true,
          text: oneLine(stringAt(line, "message")),
        });
      } else if (type === "console") {
        const source = stringAt(nested(line, "location"), "url");
        const message = oneLine(stringAt(line, "text"));
        moments.push({
          time: numberAt(line, "time"),
          kind: "console",
          text: `${stringAt(line, "messageType")}: ${message} (${source})`,
        });
      } else if (
        type === "event" &&
        field(line.event, "method") === "pageError"
      ) {
        moments.push({
          time: numberAt(line, "time"),
          kind: "page error",
          text: pageErrorText(line),
        });
      } else if (type === "resource-snapshot") {
        const snapshot = nested(line, "snapshot");
        const status = numberAt(nested(snapshot, "response"), "status");
        if (status < 400) continue;
        const request = nested(snapshot, "request");
        moments.push({
          time: numberAt(snapshot, "_monotonicTime"),
          kind: "request",
          text: `${status} ${stringAt(request, "method")} ${stringAt(request, "url")}`,
        });
      } else if (type === "screencast-frame") {
        frames.push({
          time: numberAt(line, "timestamp"),
          page: stringAt(line, "pageId"),
          file: stringAt(line, "file"),
        });
      }
    }
  }
  if (beginnings.length === 0) {
    throw new Error(
      `No context-options line in ${files.map((file) => file.name).join(", ") || "the trace"}: is it a Playwright trace?`
    );
  }
  const began = Math.min(...beginnings);

  const stepRows = [...steps.values()]
    .filter((step) => !step.configuration)
    .map((step) => {
      const end = step.end === null ? "   ..." : ms(step.end - began);
      const indent = "  ".repeat(depth(step, steps));
      const unfinished = step.end === null ? " (did not finish)" : "";
      const error = step.error ? ` error: ${step.error}` : "";
      const text = `${indent}${step.title}${unfinished}${error}`;
      return {
        time: step.start,
        text: timelineRow(`${ms(step.start - began)} - ${end}`, "step", text),
      };
    });
  const momentRows = moments.map(({ time, kind, text, atLeast }) => {
    const when = atLeast
      ? `>${Math.round(time - began)}`.padStart(6)
      : ms(time - began);
    return { time, text: momentRow(when, kind, text) };
  });
  const lastFrame = new Map<string, number>();
  const frameRows = frames
    .sort((a, b) => a.time - b.time)
    .map(({ time, page, file }) => {
      const previous = lastFrame.get(page);
      lastFrame.set(page, time);
      const gap =
        previous === undefined ? "" : ` (+${Math.round(time - previous)} ms)`;
      return {
        time,
        text: momentRow(
          ms(time - began),
          "frame",
          `${join(imageDir, file)}${gap}`
        ),
      };
    });

  // A test that opens no browser leaves only test.trace, which names nothing.
  const context = [browser, viewport].filter(Boolean).join(", ");
  return [
    title
      ? `${title}${context && ` (${context})`}`
      : "This trace names no test: the test opened no browser.",
    `Times are ms since the trace began. A time marked > is a lower bound: Playwright records none for a test's own error. Frames are under ${imageDir}.`,
    "",
    ...[...stepRows, ...momentRows, ...frameRows]
      .sort((a, b) => a.time - b.time)
      .map(({ text }) => text),
  ].join("\n");
}
