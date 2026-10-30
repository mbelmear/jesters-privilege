import { render, screen } from "@testing-library/react";
import { shell } from "@/content/shell";
import { ThemedLogo } from "./themed-logo";

describe("ThemedLogo", () => {
  it("offers the light colorway outside dark mode and the dark one in it", () => {
    render(
      <ThemedLogo
        logo={shell.logo.icon}
        alt="Jester's Privilege"
        sizes="48px"
      />
    );
    const [light, dark] = screen.getAllByRole("img", {
      name: "Jester's Privilege",
    });
    expect(light).toHaveAttribute(
      "src",
      expect.stringContaining("/images/brand/icon/")
    );
    expect(light).toHaveClass("dark:hidden");
    expect(dark).toHaveAttribute(
      "src",
      expect.stringContaining("/images/brand/icon-dark/")
    );
    expect(dark).toHaveClass("hidden", "dark:block");
  });

  it("never sends the 3000px source", () => {
    render(<ThemedLogo logo={shell.logo.icon} alt="" sizes="48px" />);
    for (const img of document.querySelectorAll("img")) {
      expect(img.getAttribute("srcset")).not.toContain("/brand/icon.png");
      expect(img.getAttribute("src")).not.toMatch(/\.png$/);
    }
  });
});
