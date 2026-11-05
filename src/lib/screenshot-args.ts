// The command line of `npm run screenshots` (scripts/screenshots.ts), read
// into what to shoot and the steps that reach a state before shooting it.

// One thing done on the page, in the order the options name them.
export type ScreenshotStep =
  // Presses the button, or ticks the checkbox, of that name.
  | { readonly kind: "click"; readonly name: string }
  // Types into the field of that label.
  | { readonly kind: "fill"; readonly label: string; readonly text: string }
  // Fires the playing Episode's audio error, as a lost connection does.
  | { readonly kind: "drop-audio" };

// How POST /api/submit answers, as the Worker would.
export type SubmitAnswer = { readonly status: number; readonly body: unknown };

export type ScreenshotArgs = {
  readonly positional: string[];
  readonly steps: ScreenshotStep[];
  readonly storage: [string, string][];
  readonly elements: string[];
  readonly missing: boolean;
  readonly submit: SubmitAnswer | null;
  readonly grantClipboard: boolean;
};

const TAKES_VALUE = [
  "--click",
  "--fill",
  "--storage",
  "--element",
  "--submit",
  "--grant",
] as const;
type OptionWithValue = (typeof TAKES_VALUE)[number];

const takesValue = (arg: string): arg is OptionWithValue =>
  TAKES_VALUE.some((option) => option === arg);

export function parseScreenshotArgs(args: readonly string[]): ScreenshotArgs {
  const positional: string[] = [];
  const steps: ScreenshotStep[] = [];
  const storage: [string, string][] = [];
  const elements: string[] = [];
  let missing = false;
  let submit: SubmitAnswer | null = null;
  let grantClipboard = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--missing") {
      missing = true;
      continue;
    }
    if (arg === "--drop-audio") {
      steps.push({ kind: "drop-audio" });
      continue;
    }
    if (!takesValue(arg)) {
      positional.push(arg);
      continue;
    }
    const value = args[i + 1];
    if (!value) throw new Error(`${arg} needs a value`);
    i += 1;
    switch (arg) {
      case "--click":
        steps.push({ kind: "click", name: value });
        break;
      case "--fill": {
        const [label, text] = splitPair(value, "--fill needs <label>=<text>");
        steps.push({ kind: "fill", label, text });
        break;
      }
      case "--storage":
        storage.push(splitPair(value, "--storage needs <key>=<value>"));
        break;
      case "--element":
        elements.push(value);
        break;
      case "--submit":
        submit = submitAnswer(value);
        break;
      case "--grant":
        if (value !== "clipboard") {
          throw new Error(`--grant takes only clipboard, not "${value}"`);
        }
        grantClipboard = true;
        break;
      default: {
        const unhandled: never = arg;
        throw new Error(`Unknown option ${String(unhandled)}`);
      }
    }
  }
  if (submit && steps.length === 0) {
    throw new Error(
      "--submit needs steps that send the form, such as --click Send"
    );
  }
  return {
    positional,
    steps,
    storage,
    elements,
    missing,
    submit,
    grantClipboard,
  };
}

// Splits at the first "=", so the value may hold more of them.
function splitPair(value: string, usage: string): [string, string] {
  const split = value.indexOf("=");
  if (split < 1) throw new Error(`${usage}, not "${value}"`);
  return [value.slice(0, split), value.slice(split + 1)];
}

function submitAnswer(value: string): SubmitAnswer {
  const usage = "--submit needs <status>=<json>";
  const [status, json] = splitPair(value, usage);
  if (!/^\d{3}$/.test(status)) throw new Error(`${usage}, not "${value}"`);
  try {
    return { status: Number(status), body: JSON.parse(json) };
  } catch {
    throw new Error(`${usage}, not "${value}"`);
  }
}
