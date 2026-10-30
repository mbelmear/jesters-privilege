import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import type { Jester } from "@/lib/content";
import { JesterPortrait } from "./jester-portrait";

const dan: Jester = {
  id: "dan",
  name: "Dan Collins",
  role: "Co-host",
  photo: {
    src: "/jesters/dan-collins.jpg",
    width: 380,
    height: 380,
    alt: "Dan Collins smiling outdoors",
  },
};
const michael: Jester = {
  id: "michael",
  name: "Michael Belmear",
  role: "Co-host",
};

describe("JesterPortrait", () => {
  it("shows a Jester's headshot from the build's image set", () => {
    render(<JesterPortrait jester={dan} />);
    const photo = screen.getByRole("img", {
      name: "Dan Collins smiling outdoors",
    });
    expect(photo.getAttribute("src")).toMatch(
      /^\/images\/jesters\/dan-collins\/\d+\.webp$/
    );
  });

  it("shows the monogram shield with their initial when there's no photo", () => {
    const { container } = render(<JesterPortrait jester={michael} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    // The name sits beside the portrait, so the shield is decoration.
    expect(container).toHaveTextContent(/^M$/);
  });

  it.each([
    ["with a photo", dan],
    ["without a photo", michael],
  ])("has no detectable accessibility violations %s", async (_, jester) => {
    const { container } = render(<JesterPortrait jester={jester} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
