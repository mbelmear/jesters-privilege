import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { content } from "@/content";
import { GalleryTeaser } from "./gallery-teaser";

const renderTeaser = () =>
  render(
    <GalleryTeaser
      painting={content.paintings.stanczyk}
      copy={content.home.gallery}
      galleryHref="/gallery"
    />
  );

describe("GalleryTeaser", () => {
  it("opens with Stańczyk under the Gallery's name, with his placard", () => {
    renderTeaser();
    const section = screen.getByRole("region", { name: "The Fools' Gallery" });
    expect(
      screen.getByRole("img", { name: content.paintings.stanczyk.alt })
    ).toBeInTheDocument();
    expect(section).toHaveTextContent("Jan Matejko");
  });

  it("invites the visitor into the Gallery", () => {
    renderTeaser();
    expect(screen.getByText(content.home.gallery.intro.text)).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Enter the Fools' Gallery" })
    ).toHaveAttribute("href", "/gallery");
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = renderTeaser();
    expect(await axe(container)).toHaveNoViolations();
  });
});
