// The Submit endpoint behind POST /api/submit. A listener's request comes in
// as unknown JSON, is narrowed to a Submission here, and leaves as one email to
// the show. The Turnstile verifier and email sender are injected (spec,
// "Submit endpoint"), so nothing here talks to Cloudflare.

export const SUBMISSION_TYPES = [
  "question",
  "confession",
  "topic-idea",
  "other",
] as const;

export type SubmissionType = (typeof SUBMISSION_TYPES)[number];

export type Submission = {
  type: SubmissionType;
  message: string;
  name: string | null;
  email: string | null;
};

export type Email = { subject: string; text: string };

export type SubmitDeps = {
  verifyTurnstile: (token: string, ip: string | null) => Promise<boolean>;
  sendEmail: (email: Email) => Promise<void>;
};

const MESSAGE_MAX_LENGTH = 5000;
const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 254;
const BODY_MAX_BYTES = 32 * 1024;

export type SubmissionField = "type" | "message" | "name" | "email" | "consent";

// Why the endpoint refused a Submission.
export const SUBMIT_ERRORS = ["invalid", "verification", "delivery"] as const;
export type SubmitError = (typeof SUBMIT_ERRORS)[number];

// What the page reads to show success or explain a failure.
export type SubmitResult =
  | { ok: true }
  | { ok: false; error: "invalid"; field?: SubmissionField }
  | { ok: false; error: Exclude<SubmitError, "invalid"> };

type Parsed =
  | { kind: "submission"; submission: Submission; token: string | null }
  | { kind: "honeypot" }
  | { kind: "invalid"; field?: SubmissionField };

export async function handleSubmit(
  request: Request,
  deps: SubmitDeps
): Promise<Response> {
  const parsed = parseRequestBody(await request.text());
  switch (parsed.kind) {
    case "invalid":
      return respond(400, { ok: false, error: "invalid", field: parsed.field });
    case "honeypot":
      // Answer as if it worked, so a bot learns nothing.
      return respond(200, { ok: true });
    case "submission":
      return deliver(
        parsed.submission,
        parsed.token,
        request.headers.get("CF-Connecting-IP"),
        deps
      );
    default: {
      const unhandled: never = parsed;
      return unhandled;
    }
  }
}

async function deliver(
  submission: Submission,
  token: string | null,
  ip: string | null,
  deps: SubmitDeps
): Promise<Response> {
  try {
    const verified = token !== null && (await deps.verifyTurnstile(token, ip));
    if (!verified) return respond(403, { ok: false, error: "verification" });
  } catch (error: unknown) {
    console.error("Submit: Turnstile couldn't verify the token", error);
    return respond(502, { ok: false, error: "verification" });
  }
  try {
    await deps.sendEmail(composeEmail(submission));
  } catch (error: unknown) {
    console.error("Submit: the email to the show couldn't be sent", error);
    return respond(502, { ok: false, error: "delivery" });
  }
  return respond(200, { ok: true });
}

function respond(status: number, result: SubmitResult): Response {
  return Response.json(result, { status });
}

function parseRequestBody(text: string): Parsed {
  if (new TextEncoder().encode(text).length > BODY_MAX_BYTES) {
    return { kind: "invalid" };
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { kind: "invalid" };
  }
  if (!isRecord(body)) return { kind: "invalid" };
  return parseFields(body);
}

function parseFields(fields: Record<string, unknown>): Parsed {
  // "website" is a field people never see; only bots fill it in.
  if (fields.website !== undefined && fields.website !== "") {
    return { kind: "honeypot" };
  }
  const checked = checkSubmission(fields);
  if (!checked.ok) {
    return { kind: "invalid", field: PROBLEM_FIELDS[checked.problems[0]] };
  }
  const token = optionalText(fields.turnstileToken, () => true);
  return {
    kind: "submission",
    submission: checked.submission,
    token: token.valid ? token.text : null,
  };
}

// Each rule a Submission's fields can break. The form shows the listener one
// message for each, and the endpoint names the field.
export const SUBMISSION_PROBLEMS = [
  "type-unknown",
  "message-missing",
  "message-too-long",
  "name-invalid",
  "email-invalid",
  "consent-missing",
] as const;

export type SubmissionProblem = (typeof SUBMISSION_PROBLEMS)[number];

export const PROBLEM_FIELDS: Record<SubmissionProblem, SubmissionField> = {
  "type-unknown": "type",
  "message-missing": "message",
  "message-too-long": "message",
  "name-invalid": "name",
  "email-invalid": "email",
  "consent-missing": "consent",
};

export type SubmissionCheck =
  | { ok: true; submission: Submission }
  | { ok: false; problems: readonly SubmissionProblem[] };

/**
 * The endpoint's rules for a Submission's fields, which the form also runs
 * before sending: every rule broken, in the form's order, or the Submission.
 */
export function checkSubmission(
  fields: Record<string, unknown>
): SubmissionCheck {
  const problems: SubmissionProblem[] = [];

  const type = SUBMISSION_TYPES.find((t) => t === fields.type);
  if (type === undefined) problems.push("type-unknown");

  const message =
    typeof fields.message === "string" ? fields.message.trim() : "";
  if (message === "") problems.push("message-missing");
  if (message.length > MESSAGE_MAX_LENGTH) problems.push("message-too-long");

  // One line only: the name lands in the email's subject.
  const name = optionalText(
    fields.name,
    (text) => text.length <= NAME_MAX_LENGTH && !/\p{Cc}/u.test(text)
  );
  if (!name.valid) problems.push("name-invalid");

  const email = optionalText(
    fields.email,
    (text) =>
      text.length <= EMAIL_MAX_LENGTH && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)
  );
  if (!email.valid) problems.push("email-invalid");

  // The listener must tick "You can mention this on the show."
  if (fields.consent !== true) problems.push("consent-missing");

  if (type === undefined || !name.valid || !email.valid || problems.length) {
    return { ok: false, problems };
  }
  return {
    ok: true,
    submission: { type, message, name: name.text, email: email.text },
  };
}

type OptionalText = { valid: true; text: string | null } | { valid: false };

// An optional field: absent or blank is null, given text must pass the rule.
function optionalText(
  value: unknown,
  rule: (text: string) => boolean
): OptionalText {
  if (value === undefined || value === null) return { valid: true, text: null };
  if (typeof value !== "string") return { valid: false };
  const trimmed = value.trim();
  if (trimmed === "") return { valid: true, text: null };
  return rule(trimmed) ? { valid: true, text: trimmed } : { valid: false };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function composeEmail(submission: Submission): Email {
  const type = TYPE_LABELS[submission.type];
  const name = submission.name ?? "Anonymous";
  return {
    subject: `${type} from ${name}`,
    text: [
      `Type: ${type}`,
      `Name: ${name}`,
      `Email: ${submission.email ?? "None given"}`,
      "Consent: Yes, this may be mentioned on the show",
      "",
      submission.message,
    ].join("\n"),
  };
}

const TYPE_LABELS: Record<SubmissionType, string> = {
  question: "Question",
  confession: "Confession",
  "topic-idea": "Topic idea",
  other: "Other",
};

// What the form sends: its fields as the listener left them, the honeypot,
// and the Turnstile widget's token.
export type SubmitRequestBody = {
  type: SubmissionType;
  message: string;
  name: string;
  email: string;
  consent: boolean;
  website: string;
  turnstileToken: string;
};

// Why a Submission wasn't sent: the endpoint's refusal, or "unreachable" when
// no answer came back from it (a dropped connection, or a reply that isn't the
// endpoint's JSON).
export type SendFailure = SubmitError | "unreachable";

export type SendOutcome = { ok: true } | { ok: false; error: SendFailure };

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** Posts a Submission to the endpoint and reads its answer. */
export async function postSubmission(
  body: SubmitRequestBody,
  fetch: Fetch
): Promise<SendOutcome> {
  let answer: unknown;
  try {
    const response = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    answer = await response.json();
  } catch {
    return { ok: false, error: "unreachable" };
  }
  return readSubmitResult(answer);
}

function readSubmitResult(answer: unknown): SendOutcome {
  if (!isRecord(answer)) return { ok: false, error: "unreachable" };
  if (answer.ok === true) return { ok: true };
  const error = SUBMIT_ERRORS.find((e) => e === answer.error);
  return { ok: false, error: error ?? "unreachable" };
}
