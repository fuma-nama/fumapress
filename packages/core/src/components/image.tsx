"use client";
import type { CSSProperties, ImgHTMLAttributes } from "react";
import type { ResolvedImageConfig } from "@/lib/image/config";
import { validateImageSrc } from "@/lib/image/shared";

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
  src: _src,
  width: _width,
  height: _height,
  blurDataURL: _blurDataURL,
  loading: _loading,
  fill,
  sizes,
  quality = __FUMAPRESS_IMAGE_CONFIG__?.quality,
  priority,
  placeholder,
  unoptimized = false,
  style,
  ...rest
}: ImageProps) {
  const { src, width, height, blurDataURL } = resolveSource({
    src: _src,
    width: _width,
    height: _height,
    blurDataURL: _blurDataURL,
  });

  const loading = priority ? "eager" : (_loading ?? "lazy");

  if (!__FUMAPRESS_IMAGE_CONFIG__ || unoptimized) {
    return (
      <img
        {...rest}
        src={src}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        loading={loading}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : undefined}
        style={{
          ...(fill ? getFillStyle() : undefined),
          ...style,
        }}
      />
    );
  }

  if (import.meta.env.DEV) {
    const validation =
      src.startsWith("https://") || src.startsWith("http://")
        ? validateImageSrc(new URL(src), __FUMAPRESS_IMAGE_CONFIG__)
        : { allowed: true };

    if (!validation.allowed) {
      throw new Error(`[Fumapress] Image src "${src}" is not allowed: ${validation.reason}`);
    }
  }

  const config = __FUMAPRESS_IMAGE_CONFIG__;
  const targetWidth = width ?? config.deviceSizes[config.deviceSizes.length - 1]!;
  const blur = placeholder === "blur" ? (blurDataURL ?? undefined) : undefined;
  const defaultSrc = buildImageUrl(src, targetWidth, quality!, config);
  const srcSet = isSvgSrc(src) ? undefined : generateSrcSet(src, targetWidth, quality!, config);

  return (
    <img
      {...rest}
      src={defaultSrc}
      srcSet={srcSet}
      sizes={sizes ?? (fill ? "100vw" : undefined)}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      loading={loading}
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
