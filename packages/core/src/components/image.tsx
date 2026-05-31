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
import { normalizeSrc, type ResolvedImageConfig, validateImageSrc } from "@/lib/shared/image";
import ReactDOM from "react-dom";
import { useRouter } from "waku";

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

const ConfigContext = createContext<ResolvedImageConfig | null>(null);

export function ConfigProvider({
  config,
  children,
}: {
  config: ResolvedImageConfig;
  children: ReactNode;
}) {
  return <ConfigContext value={config}>{children}</ConfigContext>;
}

export function buildImageUrl(
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

/** generate widths (ascending order) */
function getWidths(
  { deviceSizes, imageSizes }: ResolvedImageConfig,
  width: number | undefined,
  sizes: string | undefined,
): { widths: number[]; kind: "w" | "x" } {
  const allSizes = [...deviceSizes, ...imageSizes].sort((a, b) => a - b);

  if (sizes) {
    // Find all the "vw" percent sizes used in the sizes prop
    const viewportWidthRe = /(^|\s)(1?\d?\d)vw/g;
    const percentSizes = [];
    for (let match; (match = viewportWidthRe.exec(sizes)); match) {
      percentSizes.push(parseInt(match[2]!));
    }

    if (percentSizes.length !== 0) {
      const minRatio = Math.min(...percentSizes) * 0.01;
      const minSize = deviceSizes[0]! * minRatio;
      const minIndex = allSizes.findLastIndex((s) => s < minSize);

      return {
        widths: minIndex === -1 ? allSizes : allSizes.slice(minIndex + 1),
        kind: "w",
      };
    }

    return { widths: allSizes, kind: "w" };
  }

  if (typeof width !== "number") {
    return { widths: deviceSizes, kind: "w" };
  }

  // > This means that most OLED screens that say they are 3x resolution,
  // > are actually 3x in the green color, but only 1.5x in the red and
  // > blue colors. Showing a 3x resolution image in the app vs a 2x
  // > resolution image will be visually the same, though the 3x image
  // > takes significantly more data. Even true 3x resolution screens are
  // > wasteful as the human eye cannot see that level of detail without
  // > something like a magnifying glass.
  // https://blog.twitter.com/engineering/en_us/topics/infrastructure/2019/capping-image-fidelity-on-ultra-high-resolution-devices.html
  const widths = new Set<number>();
  const defaultWidth = allSizes.at(-1)!;
  widths.add(allSizes.find((p) => p >= width) ?? defaultWidth);
  widths.add(allSizes.find((p) => p >= width * 2) ?? defaultWidth);
  return { widths: Array.from(widths), kind: "x" };
}

export function generateImageAttributes(
  config: ResolvedImageConfig,
  src: string,
  quality: number | undefined = config.quality,
  width: number | undefined,
  sizes: string | undefined,
) {
  const { widths, kind } = getWidths(config, width, sizes);

  return {
    sizes: !sizes && kind === "w" ? "100vw" : sizes,
    srcSet: widths
      .map((w, i) => `${buildImageUrl(src, w, quality, config)} ${kind === "w" ? w : i + 1}${kind}`)
      .join(", "),

    // It's intended to keep `src` the last attribute because React updates
    // attributes in order. If we keep `src` the first one, Safari will
    // immediately start to fetch `src`, before `sizes` and `srcSet` are even
    // updated by React. That causes multiple unnecessary requests if `srcSet`
    // and `sizes` are defined.
    // This bug cannot be reproduced in Chrome or Firefox.
    src: buildImageUrl(src, widths.at(-1)!, quality, config),
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
  const config = use(ConfigContext);
  const pathname = useRouter().path;
  // resolve src to a full pathname if relative
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

  // do not optimize SVG
  if (src && src.split("?", 1)[0]!.endsWith(".svg")) {
    unoptimized = true;
  }

  if (!src || !config || unoptimized) {
    return <img {...rest} width={width} height={height} sizes={sizes} src={src} />;
  }

  if (import.meta.env.DEV) {
    const validation = validateImageSrc(config, src);

    if (!validation.allowed) {
      throw new Error(`[Fumapress] Image src "${src}" is not allowed: ${validation.reason}`);
    }
  }

  const generatedProps = generateImageAttributes(config, src, quality, width, sizes);
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
