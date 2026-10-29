import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { ThemeToggle } from "./theme-toggle";

// A controllable stand-in for the system's dark-mode setting.
function fakeSystemTheme(initiallyDark: boolean) {
  let dark = initiallyDark;
  const listeners = new Set<() => void>();
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    get matches() {
      return query === "(prefers-color-scheme: dark)" && dark;
    },
    media: query,
    addEventListener: (_: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) =>
      listeners.delete(listener),
  }));
  return {
    set(nowDark: boolean) {
      dark = nowDark;
      listeners.forEach((listener) => listener());
    },
  };
}

const toggle = () => screen.getByRole("button", { name: "Dark theme" });

describe("ThemeToggle", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("shows the system theme when no choice is remembered", () => {
    fakeSystemTheme(true);
    render(<ThemeToggle label="Dark theme" />);
    expect(toggle()).toHaveAttribute("aria-pressed", "true");
  });

  it("follows the system setting as it changes", () => {
    const system = fakeSystemTheme(false);
    render(<ThemeToggle label="Dark theme" />);
    expect(toggle()).toHaveAttribute("aria-pressed", "false");
    act(() => system.set(true));
    expect(toggle()).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a remembered choice over the system setting", () => {
    fakeSystemTheme(true);
    document.documentElement.setAttribute("data-theme", "light");
    render(<ThemeToggle label="Dark theme" />);
    expect(toggle()).toHaveAttribute("aria-pressed", "false");
  });

  it("switches the page to the other theme and remembers the choice", async () => {
    fakeSystemTheme(false);
    render(<ThemeToggle label="Dark theme" />);

    await userEvent.click(toggle());
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(toggle()).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(toggle());
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(localStorage.getItem("theme")).toBe("light");
    expect(toggle()).toHaveAttribute("aria-pressed", "false");
  });

  it("still switches when storage is unavailable", async () => {
    fakeSystemTheme(false);
    const setItem = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    render(<ThemeToggle label="Dark theme" />);
    await userEvent.click(toggle());
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    setItem.mockRestore();
  });

  it("has no detectable accessibility violations", async () => {
    fakeSystemTheme(false);
    const { container } = render(<ThemeToggle label="Dark theme" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
