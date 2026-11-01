import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { fakeTurnstile } from "@/lib/fake-turnstile";
import Submit, { metadata } from "./page";

describe("Submit", () => {
  beforeEach(() => {
    fakeTurnstile();
  });

  it("names the page in its top-level heading and the tab", () => {
    render(<Submit />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Submit" })
    ).toBeInTheDocument();
    expect(metadata.title).toBe("Submit");
  });

  it("shows the form with the spec's labels", () => {
    render(<Submit />);
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
    render(<Submit />);
    expect(
      screen.getByText(/^Your Submission goes to the Jesters' inbox/)
    ).toBeVisible();
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<Submit />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
