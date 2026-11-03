import { readFileSync } from "node:fs";
import { join } from "node:path";
import { palette } from "./palette";

const css = `
:root {
  --palette-orange: #ed6913;
  --palette-orange-deep: #d9590a;
  --palette-teal: #054f51;
  --background: light-dark(var(--palette-parchment), var(--palette-night));
}
`;

describe("palette", () => {
  it("reads a palette color from the design tokens", () => {
    const color = palette(css);
    expect(color("teal")).toBe("#054f51");
    expect(color("orange")).toBe("#ed6913");
    expect(color("orange-deep")).toBe("#d9590a");
  });

  it("names a color the tokens don't define", () => {
    expect(() => palette(css)("parchment")).toThrow("--palette-parchment");
  });

  it("finds the colors the link-preview cards use in globals.css", () => {
    const color = palette(
      readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8")
    );
    expect(color("parchment")).toBe("#f7f1e3");
    expect(color("teal")).toBe("#054f51");
  });
});
