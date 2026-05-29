"use client";
import type { CSSProperties, ImgHTMLAttributes } from "react";
import type { ResolvedImageConfig } from "@/lib/image/config";
import { isRemoteUrl, validateImageSrc } from "@/lib/image/shared";

export interface StaticImageData {
  src: string;
  width: number;
  height: number;
  blurDataURL?: string;
}

export interface ImageProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "width" | "height"
> {
  src: string | StaticImageData;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  sizes?: string;
  quality?: number;
  priority?: boolean;
  placeholder?: "blur" | "empty";
  blurDataURL?: string;
  unoptimized?: boolean;
}

function resolveSource(props: Pick<ImageProps, "src" | "width" | "height" | "blurDataURL">) {
  const src = typeof props.src === "string" ? props.src : props.src.src;
  const width = props.width ?? (typeof props.src === "object" ? props.src.width : undefined);
  const height = props.height ?? (typeof props.src === "object" ? props.src.height : undefined);
  const blurDataURL =
    props.blurDataURL ?? (typeof props.src === "object" ? props.src.blurDataURL : undefined);

  return { src, width, height, blurDataURL };
}

function isSvgSrc(src: string): boolean {
  const [path] = src.split("?", 2);
  return path!.endsWith(".svg");
}

function buildImageUrl(
  src: string,
  width: number,
  quality: number,
  config: ResolvedImageConfig,
): string {
  const params = new URLSearchParams({
    src,
    width: String(width),
    quality: String(quality),
  });

  return `${config.path}?${params.toString()}`;
}

function generateSrcSet(
  src: string,
  originalWidth: number,
  quality: number,
  config: ResolvedImageConfig,
): string {
  const widths = config.deviceSizes.filter((w) => w <= originalWidth * 2);
  const entries = widths.length === 0 ? [originalWidth] : widths;

  return entries.map((w) => `${buildImageUrl(src, w, quality, config)} ${w}w`).join(", ");
}

function getFillStyle(): CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };
}

export function Image({
  src: srcProp,
  alt,
  width,
  height,
  fill,
  sizes,
  quality,
  priority,
  placeholder,
  blurDataURL,
  unoptimized = false,
  style,
  loading,
  ...rest
}: ImageProps) {
  const {
    src,
    width: imgWidth,
    height: imgHeight,
    blurDataURL: imgBlurDataURL,
  } = resolveSource({
    src: srcProp,
    width,
    height,
    blurDataURL,
  });

  const optimize =
    __FUMAPRESS_IMAGE_CONFIG__ && !unoptimized && (src.startsWith("/") || isRemoteUrl(src));

  if (import.meta.env.DEV && optimize) {
    const validation = isRemoteUrl(src)
      ? validateImageSrc(src, __FUMAPRESS_IMAGE_CONFIG__)
      : { allowed: true };

    if (!validation.allowed) {
      throw new Error(`[Fumapress] Image src "${src}" is not allowed: ${validation.reason}`);
    }
  }

  const imageLoading = priority ? "eager" : (loading ?? "lazy");
  if (!optimize) {
    return (
      <img
        {...rest}
        src={src}
        alt={alt}
        width={fill ? undefined : imgWidth}
        height={fill ? undefined : imgHeight}
        loading={imageLoading}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : undefined}
        style={{
          ...(fill ? getFillStyle() : undefined),
          ...style,
        }}
      />
    );
  }

  const config = __FUMAPRESS_IMAGE_CONFIG__;
  const resolvedQuality = quality ?? config.quality;
  const targetWidth = imgWidth ?? config.deviceSizes[config.deviceSizes.length - 1]!;
  const blur = placeholder === "blur" ? (imgBlurDataURL ?? undefined) : undefined;
  const defaultSrc = buildImageUrl(src, targetWidth, resolvedQuality, config);
  const srcSet = isSvgSrc(src)
    ? undefined
    : generateSrcSet(src, targetWidth, resolvedQuality, config);

  return (
    <img
      {...rest}
      src={defaultSrc}
      srcSet={srcSet}
      sizes={sizes ?? (fill ? "100vw" : undefined)}
      alt={alt}
      width={fill ? undefined : imgWidth}
      height={fill ? undefined : imgHeight}
      loading={imageLoading}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : undefined}
      style={{
        ...style,
        ...(fill ? getFillStyle() : undefined),
        ...(blur
          ? {
              backgroundImage: `url(${blur})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined),
      }}
    />
  );
}

/** internal use only, do not use it */
export const _internal = {
  generateSrcSet,
  buildImageUrl,
};
