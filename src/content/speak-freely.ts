import type { SpeakFreelyPage } from "@/lib/content";

// Speak Freely, where listeners send the Jesters a Submission. The field labels, the consent line, and the name and email
// hints are the spec's words. The working messages #124's wit pass rewrote
// await the Jesters' approval; the rest are final.
export const speakFreely = {
  title: "Speak Freely",
  intro: {
    text: "Send the Jesters a Question to answer on the show, a Confession of your own folly for us to laugh about with you, a Topic idea for a future Episode, or anything else on your mind. Michael, Dan, and Aaron read every Submission.",
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
    },
    "message-missing": {
      text: "Write your message before you send it. Even jesters need material.",
    },
    "message-too-long": {
      text: "Keep your message to 5,000 characters or fewer. Brevity is the soul of wit; save the rest for a second Submission.",
    },
    "name-invalid": {
      text: "Keep your name to one line of 100 characters or fewer, so we can say it on the show in one breath.",
    },
    "email-invalid": {
      text: "That email address doesn't look complete. Check it, or leave it blank.",
    },
    "consent-missing": {
      text: "Tick the box to let us mention this on the show. We can't use a Submission without it.",
    },
    unverified: {
      text: "We're still checking this comes from a person, not a robot in motley. Wait for the check above the Send button to finish, then send again.",
    },
  },
  failed: {
    verification: {
      text: "We couldn't confirm this came from a person, so nothing was sent. Let the check above the Send button finish again, then send it.",
    },
    delivery: {
      text: "Your Submission didn't reach the Jesters' inbox, so nothing was sent: our messenger stumbled, not you. Everything you wrote is still here; try again in a few minutes.",
    },
    invalid: {
      text: "Something in the form didn't pass our checks, so nothing was sent. Look over each field and send it again.",
    },
    unreachable: {
      text: "We couldn't reach the site to send your Submission. Check your connection and send it again; everything you wrote is still here.",
    },
  },
  sent: {
    title: "Received",
    text: {
      text: "Thank you. Your Submission is in the Jesters' inbox, and you've spoken more freely than most courtiers ever dared. If we use it on the show, we'll say your name the way you wrote it, or keep you anonymous if you left it blank.",
    },
    again: "Send another",
  },
  privacyNote: {
    text: "Your Submission goes to the Jesters' inbox as one email, and is stored nowhere else. We use your email address only to reply to you, and never add it to a list.",
  },
} as const satisfies SpeakFreelyPage;
