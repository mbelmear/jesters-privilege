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

export const MESSAGE_MAX_LENGTH = 5000;
export const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 254;
const BODY_MAX_BYTES = 32 * 1024;

type SubmissionField = "type" | "message" | "name" | "email" | "consent";

// What the page reads to show success or explain a failure.
export type SubmitResult =
  | { ok: true }
  | { ok: false; error: "invalid"; field?: SubmissionField }
  | { ok: false; error: "verification" }
  | { ok: false; error: "delivery" };

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
      return deliver(parsed.submission, parsed.token, request, deps);
    default: {
      const unhandled: never = parsed;
      return unhandled;
    }
  }
}

async function deliver(
  submission: Submission,
  token: string | null,
  request: Request,
  deps: SubmitDeps
): Promise<Response> {
  if (token === null) return respond(403, { ok: false, error: "verification" });
  try {
    const ip = request.headers.get("CF-Connecting-IP");
    if (!(await deps.verifyTurnstile(token, ip))) {
      return respond(403, { ok: false, error: "verification" });
    }
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

  const type = SUBMISSION_TYPES.find((t) => t === fields.type);
  if (type === undefined) return { kind: "invalid", field: "type" };

  const message =
    typeof fields.message === "string" ? fields.message.trim() : "";
  if (message === "" || message.length > MESSAGE_MAX_LENGTH) {
    return { kind: "invalid", field: "message" };
  }

  const name = optionalText(fields.name);
  if (
    name === undefined ||
    (name !== null && (name.length > NAME_MAX_LENGTH || /\p{Cc}/u.test(name)))
  ) {
    return { kind: "invalid", field: "name" };
  }

  const email = optionalText(fields.email);
  if (
    email === undefined ||
    (email !== null &&
      (email.length > EMAIL_MAX_LENGTH ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
  ) {
    return { kind: "invalid", field: "email" };
  }

  // The listener must tick "You can mention this on the show."
  if (fields.consent !== true) return { kind: "invalid", field: "consent" };

  const token = optionalText(fields.turnstileToken) ?? null;
  return {
    kind: "submission",
    submission: { type, message, name, email },
    token,
  };
}

// Blank or absent is null; anything other than text is undefined (invalid).
function optionalText(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function composeEmail(submission: Submission): Email {
  const type = typeLabel(submission.type);
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

function typeLabel(type: SubmissionType): string {
  switch (type) {
    case "question":
      return "Question";
    case "confession":
      return "Confession";
    case "topic-idea":
      return "Topic idea";
    case "other":
      return "Other";
    default: {
      const unhandled: never = type;
      return unhandled;
    }
  }
}
