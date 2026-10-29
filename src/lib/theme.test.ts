import { THEME_STORAGE_KEY, parseTheme, themeScript } from "./theme";

// Runs the pre-paint script the way the browser does: as plain code against
// the current document.
const runThemeScript = new Function(themeScript) as () => void;

describe("themeScript", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    jest.restoreAllMocks();
  });

  it("applies a remembered dark choice to the page", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    runThemeScript();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("applies a remembered light choice to the page", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    runThemeScript();
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("leaves the page following the system setting when nothing is remembered", () => {
    runThemeScript();
    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });

  it("ignores a remembered value that isn't a theme", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    runThemeScript();
    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });

  it("doesn't throw when storage is unavailable", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(runThemeScript).not.toThrow();
    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });
});

describe("parseTheme", () => {
  it.each(["light", "dark"])("accepts %s", (value) => {
    expect(parseTheme(value)).toBe(value);
  });

  it.each([null, undefined, "", "sepia", "DARK", 1, {}])(
    "rejects %p",
    (value) => {
      expect(parseTheme(value)).toBeNull();
    }
  );
});
