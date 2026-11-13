import { tailwindIn, themeVariables } from "./css-module";

describe("tailwindIn", () => {
  const theme = new Set(["--radius-sm", "--spacing"]);

  test("finds a theme variable a module uses", () => {
    expect(
      tailwindIn(".a { border-radius: var(--radius-sm); }", theme)
    ).toEqual(["var(--radius-sm)"]);
  });

  test("finds Tailwind's at-rules and theme()", () => {
    expect(
      tailwindIn(
        '@reference "../globals.css";\n.a { @apply text-lg; color: theme(--color-red-500); }',
        theme
      )
    ).toEqual(["@apply", "@reference", "theme("]);
  });

  test("passes plain CSS on :root tokens", () => {
    expect(
      tailwindIn(
        ".a { border: 4px double var(--border); border-radius: var(--radius); }",
        theme
      )
    ).toEqual([]);
  });
});

describe("themeVariables", () => {
  test("reads the names @theme blocks emit, not :root's or a reference block's", () => {
    const css = `:root {
  --radius: 0.25rem;
  --border: light-dark(#d9cdb4, #2c4748);
}
@theme inline {
  --color-border: var(--border);
  --radius-sm: calc(var(--radius) * 0.5);
}
@theme default inline reference {
  --radius: 0.25rem;
}
@theme default {
  --tracking-wide: 0.025em;
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  --animate-spin: spin 1s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  * { --tw-x: 0; }
}`;
    expect([...themeVariables(css)].sort()).toEqual([
      "--animate-spin",
      "--color-border",
      "--radius-sm",
      "--tracking-wide",
    ]);
  });
});

test("themeVariables reads past a brace in a comment", () => {
  const css = "@theme { /* closes with } */ --after-comment: 1px; }";
  expect([...themeVariables(css)]).toEqual(["--after-comment"]);
});
