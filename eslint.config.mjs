import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Patterns for literal colors and fonts that should be design tokens.
// A 3- or 4-digit hex needs a letter so "#123" (an issue or Episode number)
// passes; `&#039;` entities and in-page `href="#feed"` anchors pass too.
const HEX_COLOR =
  "(?<!&)#(?:(?=[0-9]*[a-fA-F])[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b";
const COLOR_FUNCTION = "\\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\\(";
// Tailwind `font-['Gloock']` / `font-[Gloock]`, but not weights (`font-[600]`)
// or tokens (`font-[var(--font-display)]`).
const ARBITRARY_FONT = "\\bfont-\\[(?!var\\()(?![0-9])";
// Tailwind's built-in palette (`bg-black/10`, `text-red-500`): generated code
// such as shadcn's arrives with it. No token is named after a palette color.
const PALETTE_COLOR =
  "\\b(?:bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|fill|stroke|from|via|to|shadow|decoration|divide|placeholder|caret|accent)-(?:black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-(?:50|[1-9]00|950))?(?![\\w-])";
// Logo orange (`brand`) fails AA as text on parchment; text takes
// `text-brand-display` (large) or `text-brand-ink` (small).
const BRAND_TEXT = "\\btext-brand(?![\\w-])";

// One no-restricted-syntax entry per string form a pattern can hide in.
// Anchor links are skipped: `#feed` there is a fragment, not a color.
const inStrings = (pattern, message) =>
  [
    `Literal[value=/${pattern}/]:not(JSXAttribute[name.name='href'] > Literal)`,
    `TemplateElement[value.raw=/${pattern}/]`,
  ].map((selector) => ({ selector, message }));

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Type-aware rules: no `any` reaches our code, even from a library
  // (`JSON.parse`, `res.json()`). Narrow outside data from `unknown` instead.
  {
    files: ["**/*.{ts,tsx,mts}"],
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      // Only `as const`. Tests may assert to build partial fixtures.
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "never" },
      ],
    },
  },
  // Colors and fonts come from the design tokens in `src/app/globals.css`, so
  // dark mode and a rebrand stay one-file changes. Applies to everything in
  // `src/` except tests.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...inStrings(
          HEX_COLOR,
          "Literal hex color. Use a color token from src/app/globals.css (its utility class or var(--color-…))."
        ),
        ...inStrings(
          COLOR_FUNCTION,
          "Literal color function. Use a color token from src/app/globals.css."
        ),
        ...inStrings(
          PALETTE_COLOR,
          "Tailwind palette color. Use a color token from src/app/globals.css (bg-background, text-foreground, bg-scrim, …)."
        ),
        ...inStrings(
          BRAND_TEXT,
          "Logo orange is for ornament and fills. For orange text use text-brand-display (large) or text-brand-ink (small)."
        ),
        ...inStrings(
          ARBITRARY_FONT,
          "Literal font family. Use a font token from src/app/globals.css (its font-* utility or var(--font-…))."
        ),
        ...["fontFamily", "font"].flatMap((name) =>
          [`Property[key.name='${name}']`, `Property[key.value='${name}']`].map(
            (selector) => ({
              selector,
              message:
                "Inline font. Use a font token from src/app/globals.css (its font-* utility).",
            })
          )
        ),
      ],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "e2e/**"],
    rules: {
      "@typescript-eslint/consistent-type-assertions": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated test reports:
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    ".lighthouseci/**",
  ]),
]);

export default eslintConfig;
