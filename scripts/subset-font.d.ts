// The part of subset-font 2.9 that scripts/fonts.ts uses. @types/subset-font
// stops at 2.3, before noHinting and keepFeatures.
declare module "subset-font" {
  type AxisRange = { min: number; max: number; default?: number };

  export default function subsetFont(
    font: Buffer,
    text: string,
    options?: {
      targetFormat?: "sfnt" | "woff" | "woff2" | "truetype";
      variationAxes?: Record<string, number | AxisRange>;
      noHinting?: boolean;
      keepFeatures?: readonly string[];
    }
  ): Promise<Buffer>;
}
