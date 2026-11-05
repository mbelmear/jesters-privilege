import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { content } from "@/content";
import type { Copy } from "@/lib/content";
import { fakeTurnstile } from "@/lib/fake-turnstile";
import SpeakFreely, { metadata } from "./page";

describe("Speak Freely", () => {
  beforeEach(() => {
    fakeTurnstile();
  });

  it("names the page in its top-level heading and the tab", () => {
    render(<SpeakFreely />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Speak Freely" })
    ).toBeInTheDocument();
    expect(metadata.title).toBe("Speak Freely");
  });

  it("shows the form with the spec's labels", () => {
    render(<SpeakFreely />);
    expect(
      screen.getByRole("form", { name: "Send a Submission" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Name" })
    ).toHaveAccessibleDescription(
      "How should we say your name on the show? (Leave blank to stay anonymous.)"
    );
    expect(
      screen.getByRole("textbox", { name: "Email" })
    ).toHaveAccessibleDescription("Only if you're OK with us following up.");
    expect(
      screen.getByRole("checkbox", {
        name: "You can mention this on the show.",
      })
    ).not.toBeChecked();
    expect(screen.getByRole("combobox", { name: "Type" })).toHaveTextContent(
      "Question"
    );
  });

  it("says where a Submission goes", () => {
    render(<SpeakFreely />);
    expect(
      screen.getByText(/^Your Submission goes to the Jesters' inbox/)
    ).toBeVisible();
  });

  // Its own draft, so the test holds whatever the Jesters have approved.
  it("marks draft copy with the DRAFT ribbon on a preview", () => {
    jest.replaceProperty<{ intro: Copy }, "intro">(
      content.speakFreely,
      "intro",
      {
        ...content.speakFreely.intro,
        draft: true,
      }
    );
    const before = process.env.SITE_ENV;
    process.env.SITE_ENV = "preview";
    try {
      render(<SpeakFreely />);
      expect(screen.getByRole("note")).toHaveTextContent("Draft");
    } finally {
      if (before === undefined) delete process.env.SITE_ENV;
      else process.env.SITE_ENV = before;
    }
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<SpeakFreely />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
