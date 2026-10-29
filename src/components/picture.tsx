import { getImageProps } from "next/image";
import type { CSSProperties } from "react";
import type { FocalPoint, ImageFile } from "@/lib/content";
import {
  cropAround,
  imageUrl,
  type CropName,
  type ImageFormat,
} from "@/lib/images";

type Props = {
  image: ImageFile;
  alt: string;
  // How wide the image shows, as the `sizes` attribute: it picks the srcset
  // entry a browser downloads.
  sizes: string;
  // "eager" for an image on the first screen.
  loading?: "eager" | "lazy";
  // "high" for the page's largest paint, so it fetches ahead of the rest.
  fetchPriority?: "high";
  // Below the md breakpoint, show this crop around the focal point instead
  // of the whole image.
  phone?: { crop: CropName; focalPoint: FocalPoint };
  className?: string;
  style?: CSSProperties;
};

// Phones are narrower than Tailwind's md breakpoint.
const PHONE = "(width < 48rem)";

/**
 * An image from the build's responsive set (scripts/images.ts): AVIF where
 * the browser takes it, WebP otherwise, at the width `sizes` calls for.
 */
export function Picture({
  image,
  alt,
  sizes,
  loading = "lazy",
  fetchPriority,
  phone,
  className,
  style,
}: Props) {
  const imageProps = (format: ImageFormat, crop?: CropName) => {
    const region =
      crop && phone ? cropAround(image, phone.focalPoint, crop) : image;
    return getImageProps({
      src: image.src,
      width: region.width,
      height: region.height,
      alt,
      sizes,
      loading,
      loader: ({ src, width }) => imageUrl({ src, width, format, crop }),
    }).props;
  };
  const srcSet = (format: ImageFormat, crop?: CropName) =>
    imageProps(format, crop).srcSet;
  const props = imageProps("webp");
  return (
    <picture>
      {phone && (
        <>
          <source
            media={PHONE}
            type="image/avif"
            srcSet={srcSet("avif", phone.crop)}
            sizes={sizes}
          />
          <source
            media={PHONE}
            type="image/webp"
            srcSet={srcSet("webp", phone.crop)}
            sizes={sizes}
          />
        </>
      )}
      <source type="image/avif" srcSet={srcSet("avif")} sizes={sizes} />
      <img
        {...props}
        alt={alt}
        fetchPriority={fetchPriority}
        className={className}
        style={style}
      />
    </picture>
  );
}
