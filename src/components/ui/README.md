# UI primitives

shadcn/ui components, owned in the repo and restyled to the design tokens. Add one with:

```bash
npx shadcn@latest add <name>
```

The generated file arrives with shadcn's default look. Restyle it before use, following `button.tsx`:

- Colors come from the tokens in `src/app/globals.css`. Drop the generated `dark:` classes, because each token already carries its dark value; lint rejects any Tailwind palette color such as `bg-black/10` (use `bg-scrim`).
- Interface text uses `font-ui`. Corners use the `rounded-*` radius tokens, shadows the `shadow-*` tokens.
- Focus shows as `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`.
- Transitions and open/close animations use `duration-(--motion-courtly-duration) ease-courtly`.
- Labels (a close button's screen-reader name, for example) arrive as props from content, never as English defaults.

Then add the component to the style guide (`src/app/styleguide/`) so it shows in both themes.
