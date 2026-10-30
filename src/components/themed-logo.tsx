import { Picture, type PictureLoading } from "@/components/picture";
import type { ThemedImage } from "@/lib/content";
import { cn } from "@/lib/utils";

type Props = {
  logo: ThemedImage;
  alt: string;
  sizes: string;
  loading?: PictureLoading;
  // Sizes each image; the theme decides which one shows.
  className?: string;
};

/**
 * A logo in the colorway for the current theme. Both are in the HTML and CSS
 * hides one, so a remembered theme (set before first paint) never flashes
 * the other.
 */
export function ThemedLogo({ logo, alt, sizes, loading, className }: Props) {
  return (
    <>
      <Picture
        image={logo.light}
        alt={alt}
        sizes={sizes}
        loading={loading}
        className={cn(className, "dark:hidden")}
      />
      <Picture
        image={logo.dark}
        alt={alt}
        sizes={sizes}
        loading={loading}
        className={cn(className, "hidden dark:block")}
      />
    </>
  );
}
