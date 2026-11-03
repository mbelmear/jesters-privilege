// The palette's colors as literal values, read from the design tokens in
// globals.css, for drawing that can't read CSS variables: the link-preview
// cards, which Next's ImageResponse renders at build time.
export function palette(css: string): (name: string) => string {
  return (name) => {
    const match = new RegExp(`--palette-${name}:\\s*([^;]+);`).exec(css);
    if (!match) {
      throw new Error(`Palette: the design tokens define no --palette-${name}`);
    }
    return match[1].trim();
  };
}
