import type { SubmitPage } from "@/lib/content";

// The Submit page. The field labels, the consent line, and the name and email
// hints are the spec's words; the rest awaits the Jesters'.
export const submit = {
  title: "Submit",
  intro: {
    text: "Send the Jesters a Question to answer on the show, a Confession of your own folly for us to laugh about with you, a Topic idea for a future Episode, or anything else on your mind. Michael, Dan, and Aaron read every Submission.",
    draft: true,
  },
  form: {
    label: "Send a Submission",
    type: {
      label: "Type",
      options: {
        question: "Question",
        confession: "Confession",
        "topic-idea": "Topic idea",
        other: "Other",
      },
    },
    message: { label: "Message" },
    name: {
      label: "Name",
      hint: "How should we say your name on the show? (Leave blank to stay anonymous.)",
    },
    email: { label: "Email", hint: "Only if you're OK with us following up." },
    consent: "You can mention this on the show.",
    honeypot: "Leave this field empty",
    send: "Send",
    sending: "Sending",
  },
  problems: {
    "type-unknown": {
      text: "Choose what kind of Submission this is.",
      draft: true,
    },
    "message-missing": {
      text: "Write your message before you send it.",
      draft: true,
    },
    "message-too-long": {
      text: "Keep your message to 5,000 characters or fewer. Save the rest for a second Submission.",
      draft: true,
    },
    "name-invalid": {
      text: "Keep your name to one line of 100 characters or fewer.",
      draft: true,
    },
    "email-invalid": {
      text: "That email address doesn't look complete. Check it, or leave it blank.",
      draft: true,
    },
    "consent-missing": {
      text: "Tick the box to let us mention this on the show. We can't use a Submission without it.",
      draft: true,
    },
    unverified: {
      text: "We're still checking this comes from a person. Wait for the check above the Send button to finish, then send again.",
      draft: true,
    },
  },
  failed: {
    verification: {
      text: "We couldn't confirm this came from a person, so nothing was sent. Let the check above the Send button finish again, then send it.",
      draft: true,
    },
    delivery: {
      text: "Your Submission didn't reach the Jesters' inbox, so nothing was sent. Everything you wrote is still here; try again in a few minutes.",
      draft: true,
    },
    invalid: {
      text: "Something in the form didn't pass our checks, so nothing was sent. Look over each field and send it again.",
      draft: true,
    },
    unreachable: {
      text: "We couldn't reach the site to send your Submission. Check your connection and send it again; everything you wrote is still here.",
      draft: true,
    },
  },
  sent: {
    title: "Received",
    text: {
      text: "Thank you. Your Submission is in the Jesters' inbox. If we use it on the show, we'll say your name the way you wrote it, or keep you anonymous if you left it blank.",
      draft: true,
    },
    again: "Send another",
  },
  privacyNote: {
    text: "Your Submission goes to the Jesters' inbox as one email, and is stored nowhere else. We use your email address only to reply to you, and never add it to a list.",
    draft: true,
  },
} as const satisfies SubmitPage;
