"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SubmitPage } from "@/lib/content";
import {
  checkSubmission,
  postSubmission,
  PROBLEM_FIELDS,
  SUBMISSION_TYPES,
  type SendFailure,
  type SubmissionField,
  type SubmissionProblem,
  type SubmissionType,
} from "@/lib/submit";
import { TurnstileWidget } from "./turnstile-widget";

type Props = {
  copy: SubmitPage;
  siteKey: string;
};

type Fields = {
  type: SubmissionType;
  message: string;
  name: string;
  email: string;
  consent: boolean;
  // The honeypot.
  website: string;
};

const EMPTY: Fields = {
  type: "question",
  message: "",
  name: "",
  email: "",
  consent: false,
  website: "",
};

// Problems show only once the listener has tried to send ("checked"); from
// then on, a failed send included, they follow the fields as they change.
type FormState =
  | { status: "editing" }
  | { status: "checked" }
  | { status: "sending" }
  | { status: "failed"; error: SendFailure }
  | { status: "sent" };

type Problem = SubmissionProblem | "unverified";

const inputClasses =
  "w-full rounded-md border border-input bg-card px-3 py-2.5 font-body text-base text-foreground transition-colors duration-(--motion-courtly-duration) ease-courtly hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-destructive";

/**
 * The Submit form: a listener's Submission, checked with the endpoint's own
 * rules before it goes, then a confirmation or an explanation of what failed.
 */
export function SubmitForm({ copy, siteKey }: Props) {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [token, setToken] = useState<string | null>(null);
  // A token passes one Submission; each send remounts the widget for another.
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<FormState>({ status: "editing" });
  const id = useId();
  const ready = useHydrated();
  const fieldId = (field: SubmissionField | "website") => `${id}-${field}`;

  const problems =
    state.status === "checked" || state.status === "failed"
      ? problemsOf(fields, token)
      : [];
  const problemFor = (field: SubmissionField) =>
    problems.find(
      (p): p is SubmissionProblem =>
        p !== "unverified" && PROBLEM_FIELDS[p] === field
    );

  function set<K extends keyof Fields>(field: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [field]: value }));
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status === "sending") return;
    const found = problemsOf(fields, token);
    if (found.length > 0 || token === null) {
      setState({ status: "checked" });
      const first = found.find((p) => p !== "unverified");
      if (first)
        document.getElementById(fieldId(PROBLEM_FIELDS[first]))?.focus();
      return;
    }
    setState({ status: "sending" });
    const outcome = await postSubmission(
      { ...fields, turnstileToken: token },
      // Wrapped so a test's or the browser's fetch is the one called.
      (url, init) => fetch(url, init)
    );
    setToken(null);
    setAttempt((n) => n + 1);
    setState(
      outcome.ok
        ? { status: "sent" }
        : { status: "failed", error: outcome.error }
    );
  }

  function startOver() {
    setFields(EMPTY);
    setState({ status: "editing" });
  }

  if (state.status === "sent") {
    return <Sent copy={copy.sent} onAgain={startOver} />;
  }

  const describedBy = (field: SubmissionField, hint?: boolean) =>
    [
      hint && `${fieldId(field)}-hint`,
      problemFor(field) && `${fieldId(field)}-problem`,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  const problemText = (field: SubmissionField) => {
    const problem = problemFor(field);
    return problem ? (
      <p
        id={`${fieldId(field)}-problem`}
        className="font-ui text-sm font-medium text-destructive"
      >
        {copy.problems[problem].text}
      </p>
    ) : null;
  };

  return (
    <form aria-label={copy.form.label} noValidate onSubmit={send}>
      {/* Disabled in the page's HTML until React runs: text typed before
          then would be wiped, and Send would post the form natively. */}
      <fieldset disabled={!ready} className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor={fieldId("type")} className="font-ui font-medium">
            {copy.form.type.label}
          </label>
          <Select
            value={fields.type}
            onValueChange={(value) => {
              const type = SUBMISSION_TYPES.find((t) => t === value);
              if (type) set("type", type);
            }}
          >
            <SelectTrigger
              id={fieldId("type")}
              aria-invalid={problemFor("type") ? true : undefined}
              aria-describedby={describedBy("type")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUBMISSION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {copy.form.type.options[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {problemText("type")}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={fieldId("message")} className="font-ui font-medium">
            {copy.form.message.label}
          </label>
          <textarea
            id={fieldId("message")}
            name="message"
            rows={7}
            required
            value={fields.message}
            onChange={(e) => set("message", e.target.value)}
            aria-invalid={problemFor("message") ? true : undefined}
            aria-describedby={describedBy("message")}
            className={inputClasses}
          />
          {problemText("message")}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={fieldId("name")} className="font-ui font-medium">
            {copy.form.name.label}
          </label>
          <p
            id={`${fieldId("name")}-hint`}
            className="text-sm text-muted-foreground"
          >
            {copy.form.name.hint}
          </p>
          <input
            id={fieldId("name")}
            name="name"
            type="text"
            autoComplete="nickname"
            value={fields.name}
            onChange={(e) => set("name", e.target.value)}
            aria-invalid={problemFor("name") ? true : undefined}
            aria-describedby={describedBy("name", true)}
            className={inputClasses}
          />
          {problemText("name")}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={fieldId("email")} className="font-ui font-medium">
            {copy.form.email.label}
          </label>
          <p
            id={`${fieldId("email")}-hint`}
            className="text-sm text-muted-foreground"
          >
            {copy.form.email.hint}
          </p>
          <input
            id={fieldId("email")}
            name="email"
            type="email"
            autoComplete="email"
            value={fields.email}
            onChange={(e) => set("email", e.target.value)}
            aria-invalid={problemFor("email") ? true : undefined}
            aria-describedby={describedBy("email", true)}
            className={inputClasses}
          />
          {problemText("email")}
        </div>

        {/* Hidden from people, so only a bot fills it in. */}
        <div aria-hidden="true" className="sr-only">
          <label htmlFor={fieldId("website")}>{copy.form.honeypot}</label>
          <input
            id={fieldId("website")}
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={fields.website}
            onChange={(e) => set("website", e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-3">
            <Checkbox
              id={fieldId("consent")}
              checked={fields.consent}
              onCheckedChange={(checked) => set("consent", checked === true)}
              aria-invalid={problemFor("consent") ? true : undefined}
              aria-describedby={describedBy("consent")}
              className="mt-0.5"
            />
            <label htmlFor={fieldId("consent")} className="font-ui font-medium">
              {copy.form.consent}
            </label>
          </div>
          {problemText("consent")}
        </div>

        <TurnstileWidget key={attempt} siteKey={siteKey} onToken={setToken} />

        {/* Present from the start, so screen readers announce what fills it. */}
        <div
          role="alert"
          className="font-ui text-sm font-medium text-destructive empty:hidden"
        >
          {state.status === "failed"
            ? copy.failed[state.error].text
            : problems.includes("unverified")
              ? copy.problems.unverified.text
              : null}
        </div>

        <Button
          type="submit"
          size="lg"
          className="self-start"
          disabled={state.status === "sending"}
        >
          {state.status === "sending" ? copy.form.sending : copy.form.send}
        </Button>
      </fieldset>
    </form>
  );
}

const noSubscription = () => () => {};

// False while the server renders the page's HTML, true once React runs.
function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false
  );
}

function problemsOf(fields: Fields, token: string | null): Problem[] {
  const checked = checkSubmission(fields);
  const problems: Problem[] = checked.ok ? [] : [...checked.problems];
  if (token === null) problems.push("unverified");
  return problems;
}

function Sent({
  copy,
  onAgain,
}: {
  copy: SubmitPage["sent"];
  onAgain: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Moves focus from the vanished form to the news that it went.
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="flex flex-col items-start gap-4">
      <h2
        ref={heading}
        tabIndex={-1}
        className="font-display text-3xl focus:outline-none"
      >
        {copy.title}
      </h2>
      <p className="text-lg">{copy.text.text}</p>
      <Button type="button" variant="outline" onClick={onAgain}>
        {copy.again}
      </Button>
    </section>
  );
}
