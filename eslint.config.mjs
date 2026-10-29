import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
  // dark mode and a rebrand stay one-file changes. Flags literal colors and
  // Tailwind arbitrary color/font values in components and content.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...[
          "Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
          "TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]",
        ].map((selector) => ({
          selector,
          message:
            "Literal hex color. Use a design token from src/app/globals.css (a token utility class or var(--…)).",
        })),
        ...[
          "Literal[value=/\\b(rgba?|hsla?|oklch|oklab)\\(/]",
          "TemplateElement[value.raw=/\\b(rgba?|hsla?|oklch|oklab)\\(/]",
        ].map((selector) => ({
          selector,
          message:
            "Literal color function. Use a design token from src/app/globals.css.",
        })),
        ...[
          "Literal[value=/\\bfont-\\[/]",
          "TemplateElement[value.raw=/\\bfont-\\[/]",
          "Property[key.name='fontFamily']",
        ].map((selector) => ({
          selector,
          message:
            "Literal font. Use a font token from src/app/globals.css (e.g. a font-display/font-body utility).",
        })),
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
