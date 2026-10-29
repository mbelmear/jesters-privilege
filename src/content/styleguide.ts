// Copy for the style guide (/styleguide), an internal page for checking the
// design system. Token names must match src/app/globals.css.

export const styleguide = {
  title: "Style guide",
  intro:
    "Every color, typeface, shape, motion preset, and component the site is built from, shown in both themes. Change a token in globals.css and check it here.",
  themeToggleLabel: "Dark theme",
  panels: { light: "Light theme", dark: "Dark theme" },
  sections: {
    colors: "Colors",
    type: "Typefaces",
    shape: "Radii and shadows",
    motion: "Motion",
    components: "Components",
  },
  colors: [
    { token: "background", role: "Page background (parchment, or teal-black)" },
    { token: "foreground", role: "Body text and headings" },
    { token: "card", role: "Raised surfaces: cards, menus, dialogs" },
    { token: "muted", role: "Quiet fills and hover highlights" },
    { token: "muted-foreground", role: "Secondary text: dates, captions" },
    { token: "primary", role: "Links and primary actions (teal)" },
    { token: "primary-foreground", role: "Text on a primary fill" },
    { token: "brand", role: "Logo orange: ornament and fills only" },
    { token: "on-brand", role: "Text on an orange fill" },
    { token: "brand-display", role: "Orange for large text (3:1 or better)" },
    { token: "brand-ink", role: "Orange for small text (4.5:1 or better)" },
    { token: "border", role: "Hairlines and dividers" },
    { token: "input", role: "Form field outlines" },
    { token: "ring", role: "Keyboard focus" },
    { token: "destructive", role: "Errors and failure states" },
    {
      token: "scrim",
      role: "Overlay behind dialogs and under painting titles",
    },
  ],
  typefaces: [
    {
      name: "Gloock",
      role: "Display: headlines, decree-style titles, the drop cap",
      utility: "font-display",
      sample: "Hear ye: the fool may speak where the courtier dare not.",
    },
    {
      name: "Source Serif 4",
      role: "Body: everything meant to be read",
      utility: "font-body",
      sample:
        "In the old courts, the jester alone could tell the king the truth and keep his head. Three friends from Redeemer Church borrow the privilege each week, serving a better King and laughing at the folly they find, starting with their own.",
    },
    {
      name: "Barlow Semi Condensed",
      role: "Interface: navigation, buttons, labels, metadata",
      utility: "font-ui",
      sample: "Episodes · Fools' Gallery · About · Submit",
    },
  ],
  typeScale: {
    display: "Celebrity Pastors",
    heading: "The Fools' Gallery",
    orangeDisplay: "Episode 1",
    smallOrange: "Bonus",
    link: "Read the full transcript",
    italic: "We are fools for Christ's sake. (1 Corinthians 4:10)",
    meta: "Oct 29, 2026 · 52 min",
  },
  radii: ["sm", "md", "lg", "xl"],
  shadows: ["sm", "md", "lg"],
  motion: [
    {
      name: "processional",
      role: "Slow and stately, for reveals: paintings, hero copy, sections",
    },
    {
      name: "courtly",
      role: "Quick and polite, for menus, dialogs, and interface responses",
    },
  ],
  motionReplay: "Replay",
  motionReducedNote:
    "With reduced motion turned on, these finish instantly, site-wide.",
  components: {
    buttons: {
      heading: "Buttons",
      variants: [
        { variant: "default", label: "Listen now" },
        { variant: "brand", label: "Send it in" },
        { variant: "outline", label: "All episodes" },
        { variant: "secondary", label: "Share" },
        { variant: "ghost", label: "Cancel" },
        { variant: "destructive", label: "Try again" },
        { variant: "link", label: "Meet the Jesters" },
      ],
      disabled: "Sending…",
    },
    toggle: { heading: "Toggle", off: "Timestamps", on: "Follow along" },
    checkbox: {
      heading: "Checkbox",
      label: "You can mention this on the show.",
    },
    select: {
      heading: "Select",
      label: "What are you sending?",
      options: [
        { value: "question", label: "Question" },
        { value: "confession", label: "Confession" },
        { value: "topic-idea", label: "Topic idea" },
        { value: "other", label: "Other" },
      ],
    },
    dialog: {
      heading: "Dialog",
      open: "Open dialog",
      title: "Resume where you left off?",
      description:
        "You were 23 minutes into Episode 1, Celebrity Pastors. Pick up there, or start from the beginning.",
      confirm: "Resume",
      cancel: "Start over",
      close: "Close",
    },
    menu: {
      heading: "Menu",
      open: "Open menu",
      label: "The court",
      items: ["Episodes", "Fools' Gallery", "About", "Submit"],
    },
  },
} as const;
