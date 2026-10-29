import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { DraftRibbon } from "./draft-ribbon";

const draftBio = {
  text: "Dan is Redeemer's Discipleship Pastor.",
  draft: true,
};
const finalHero = { paragraphs: ["Long ago, in the great halls of Europe…"] };

describe("DraftRibbon", () => {
  it("marks a preview page that uses draft content", async () => {
    const { container } = render(
      <DraftRibbon uses={[finalHero, draftBio]} preview />
    );
    expect(
      screen.getByRole("note", {
        name: "Draft: this page uses copy awaiting the Jesters' words.",
      })
    ).toHaveTextContent("Draft");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("shows nothing on a preview page whose content is all final", () => {
    const { container } = render(<DraftRibbon uses={[finalHero]} preview />);
    expect(container).toBeEmptyDOMElement();
  });

  it("never shows in production", () => {
    const { container } = render(
      <DraftRibbon uses={[draftBio]} preview={false} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
