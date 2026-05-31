// the following component took reference from Next.js Image for edge cases in production
/*
The MIT License (MIT)

Copyright (c) 2025 Vercel, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

"use client";
import { type ReactNode, type ImgHTMLAttributes, createContext, use, useMemo } from "react";
import ReactDOM from "react-dom";
import { useRouter } from "waku";

export type ClientImageContext = {
  provider: ClientImageProvider;
};

export interface ClientImageProvider {
  name: string;
  /**
   * All allowed sizes. If `undefined`, it assumes the provider allows any given width.
   * (Ascending order)
   */
  sizes?: number[];

  /**
   * A subset of `sizes` that can potentially be the viewport width, will be used to generate `srcset`.
   * (Ascending order)
   */
  deviceSizes: number[];
  defaultQuality: number;

  /** run check on `src` if specified */
  validate?: (src: string) => void;
  /** check if the image can be optimized */
  canOptimize?: (src: string) => boolean;
  buildImageUrl: (params: { src: string; width: number; quality: number }) => string;
}

export interface StaticImageData {
  src: string;
  width: number;
  height: number;
}

export interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string | StaticImageData;

  /** a value between 1-100, the quality of optimized image */
  quality?: number;

  /** Act like a normal `<img>` tag, default to `false` except for SVG images */
  unoptimized?: boolean;

  /** Preload the image @default true */
  preload?: boolean;
}

function parseLength(v: string | number | undefined): number | undefined {
  if (typeof v !== "string") return v;

  const parsed = parseInt(v, 10);
  if (Number.isNaN(parsed))
    throw new Error(
      `[Fumapress] <Image /> only accepts integer values of width/height, received: "${v}"`,
    );
  return parsed;
}

/**
 * resolve src to a full pathname if relative
 */
function normalizeSrc(src: string, basePathname: string): string {
  if (src.startsWith("http://") || src.startsWith("https://")) return src;

  const base = new URL(basePathname, "http://localhost");
  const resolved = new URL(src, base);

  if (resolved.hostname !== base.hostname)
    throw new Error(`The src attribute "${src}" is not a valid relative path`);
  return resolved.pathname;
}

const ImageContext = createContext<ClientImageContext | null>(null);

export function ImageProvider({
  provider,
  children,
}: ClientImageContext & {
  children: ReactNode;
}) {
  return <ImageContext value={useMemo(() => ({ provider }), [provider])}>{children}</ImageContext>;
}

/** generate widths (ascending order) */
function getWidths(
  provider: ClientImageProvider,
  width: number | undefined,
  sizes: string | undefined,
): { widths: number[]; kind: "w" | "x" } {
  if (sizes) {
    const allSizes = provider.sizes ?? provider.deviceSizes;
    // Find all the "vw" percent sizes used in the sizes prop
    const viewportWidthRe = /(^|\s)(1?\d?\d)vw/g;
    const percentSizes = [];
    for (let match; (match = viewportWidthRe.exec(sizes)); match) {
      percentSizes.push(parseInt(match[2]!));
    }

    if (percentSizes.length !== 0) {
      const minRatio = Math.min(...percentSizes) * 0.01;
      const minSize = provider.deviceSizes[0]! * minRatio;
      const minIndex = allSizes.findLastIndex((s) => s < minSize);

      return {
        widths: minIndex === -1 ? allSizes : allSizes.slice(minIndex + 1),
        kind: "w",
      };
    }

    return { widths: allSizes, kind: "w" };
  }

  if (typeof width !== "number") {
    return { widths: provider.deviceSizes, kind: "w" };
  }

  // > This means that most OLED screens that say they are 3x resolution,
  // > are actually 3x in the green color, but only 1.5x in the red and
  // > blue colors. Showing a 3x resolution image in the app vs a 2x
  // > resolution image will be visually the same, though the 3x image
  // > takes significantly more data. Even true 3x resolution screens are
  // > wasteful as the human eye cannot see that level of detail without
  // > something like a magnifying glass.
  // https://blog.twitter.com/engineering/en_us/topics/infrastructure/2019/capping-image-fidelity-on-ultra-high-resolution-devices.html
  if (provider.sizes) {
    const widths = new Set<number>();
    const sizes = provider.sizes;
    const defaultWidth = sizes.at(-1)!;
    widths.add(sizes.find((p) => p >= width) ?? defaultWidth);
    widths.add(sizes.find((p) => p >= width * 2) ?? defaultWidth);
    return { widths: Array.from(widths), kind: "x" };
  }

  return { widths: [width, width * 2], kind: "x" };
}

export function generateImageAttributes(
  provider: ClientImageProvider,
  src: string,
  quality: number | undefined = provider.defaultQuality,
  width: number | undefined,
  sizes: string | undefined,
) {
  const { widths, kind } = getWidths(provider, width, sizes);

  return {
    sizes: !sizes && kind === "w" ? "100vw" : sizes,
    srcSet: widths
      .map(
        (w, i) =>
          `${provider.buildImageUrl({ src, width: w, quality })} ${kind === "w" ? w : i + 1}${kind}`,
      )
      .join(", "),

    // It's intended to keep `src` the last attribute because React updates
    // attributes in order. If we keep `src` the first one, Safari will
    // immediately start to fetch `src`, before `sizes` and `srcSet` are even
    // updated by React. That causes multiple unnecessary requests if `srcSet`
    // and `sizes` are defined.
    // This bug cannot be reproduced in Chrome or Firefox.
    src: provider.buildImageUrl({ src, width: widths.at(-1)!, quality }),
  } satisfies ImgHTMLAttributes<HTMLImageElement>;
}

export function Image({
  src: _src,
  width: _width,
  height: _height,
  sizes,
  quality,
  unoptimized = false,
  preload = true,
  ...rest
}: ImageProps) {
  const ctx = use(ImageContext);
  const pathname = useRouter().path;
  const { src, width, height } = useMemo(() => {
    if (typeof _src === "object") {
      return {
        src: normalizeSrc(_src.src, pathname),
        width: parseLength(_width ?? _src.width),
        height: parseLength(_height ?? _src.height),
      };
    }

    return {
      src: _src ? normalizeSrc(_src, pathname) : undefined,
      width: parseLength(_width),
      height: parseLength(_height),
    };
  }, [_src, _width, _height, pathname]);

  if (src && ctx?.provider.canOptimize && !ctx.provider.canOptimize(src)) {
    unoptimized = true;
  }

  if (!src || !ctx || unoptimized) {
    return <img {...rest} width={width} height={height} sizes={sizes} src={src} />;
  }

  const { provider } = ctx;
  provider.validate?.(src);

  const generatedProps = generateImageAttributes(provider, src, quality, width, sizes);
  let preloadElement: ReactNode;

  if (preload) {
    const preloadOptions: ReactDOM.PreloadOptions = {
      as: "image",
      imageSrcSet: generatedProps.srcSet,
      imageSizes: generatedProps.sizes,
      crossOrigin: rest.crossOrigin,
      referrerPolicy: rest.referrerPolicy,
      fetchPriority: rest.fetchPriority,
    };

    if (ReactDOM.preload) {
      ReactDOM.preload(generatedProps.src, preloadOptions);
    } else {
      preloadElement = (
        <link
          key={"press-img-" + generatedProps.src + generatedProps.srcSet + generatedProps.sizes}
          rel="preload"
          // Note how we omit the `href` attribute, as it would only be relevant
          // for browsers that do not support `imagesrcset`, and in those cases
          // it would cause the incorrect image to be preloaded.
          //
          // https://html.spec.whatwg.org/multipage/semantics.html#attr-link-imagesrcset
          href={generatedProps.srcSet ? undefined : generatedProps.src}
          {...preloadOptions}
        />
      );
    }
  }

  return (
    <>
      {preloadElement}
      <img {...rest} width={width} height={height} {...generatedProps} />
    </>
  );
}
