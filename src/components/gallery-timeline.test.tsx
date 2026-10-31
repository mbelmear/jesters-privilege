import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { content } from "@/content";
import { GalleryTimeline } from "./gallery-timeline";

const { gallery } = content;

describe("GalleryTimeline", () => {
  it("walks through the eras in order", () => {
    render(<GalleryTimeline gallery={gallery} />);
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)
    ).toEqual([
      "Holy Fools",
      "The Medieval Court",
      "The Renaissance",
      "The Reformation",
      "Why this show wears the motley",
    ]);
  });

  it("opens the Renaissance with a painting band under the era's name", () => {
    render(<GalleryTimeline gallery={gallery} />);
    const band = within(
      screen.getByRole("region", { name: "The Renaissance" })
    ).getAllByRole("figure")[0];
    expect(within(band).getByRole("img")).toHaveAccessibleName(
      /distorted skull/
    );
    expect(within(band).getByText("Hans Holbein the Younger")).toBeVisible();
    expect(
      within(band).getByRole("heading", { level: 2, name: "The Renaissance" })
    ).toBeVisible();
  });

  it("dates each era and introduces it", () => {
    render(<GalleryTimeline gallery={gallery} />);
    const era = screen.getByRole("region", { name: "The Medieval Court" });
    expect(within(era).getByText("1100–1450")).toBeVisible();
    expect(
      within(era).getByRole("heading", { level: 3, name: "The licensed fool" })
    ).toBeVisible();
    expect(
      within(era).getByText(/^In the great households of medieval Europe/)
    ).toBeVisible();
  });

  it("hangs Stańczyk in the Renaissance, framed beside his story", () => {
    render(<GalleryTimeline gallery={gallery} />);
    const era = screen.getByRole("region", { name: "The Renaissance" });
    const fool = within(era).getByRole("article", { name: "Stańczyk" });
    expect(
      within(fool).getByRole("heading", { level: 3, name: "Stańczyk" })
    ).toBeVisible();
    expect(within(fool).getByText("c. 1480–1560")).toBeVisible();
    expect(within(fool).getByRole("img")).toHaveAccessibleName(
      /^The jester Stańczyk slumped alone in a chair/
    );
    const placard = within(fool).getByRole("figure");
    expect(within(placard).getByText("Jan Matejko")).toBeVisible();
    expect(
      within(placard).getByText("National Museum in Warsaw")
    ).toBeVisible();
    expect(
      within(fool).getByText(/^Stańczyk served three kings/)
    ).toBeVisible();
  });

  it("gives each Fool an address of their own on the page", () => {
    render(<GalleryTimeline gallery={gallery} />);
    expect(screen.getByRole("article", { name: "Stańczyk" })).toHaveAttribute(
      "id",
      "stanczyk"
    );
  });

  it("ends with why this show wears the motley", () => {
    render(<GalleryTimeline gallery={gallery} />);
    const closing = screen.getByRole("region", {
      name: "Why this show wears the motley",
    });
    expect(
      within(closing).getByText(/^So we put on the motley\./)
    ).toBeVisible();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <main>
        <GalleryTimeline gallery={gallery} />
      </main>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
