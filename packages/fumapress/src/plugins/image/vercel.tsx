import type { WakuAppShape, WakuPlugin } from "@/press";
import { VercelImageProvider } from "./vercel.client";
import { resolveVercelImageConfig } from "./vercel.utils";

export interface VercelRemotePattern {
  protocol?: "http" | "https";
  hostname: string;
  port?: string;
  pathname?: string;
  search?: string;
}

export interface VercelLocalPattern {
  pathname?: string;
  search?: string;
}

/** @see https://vercel.com/docs/project-configuration#images */
export interface VercelImageOptions {
  /** Allowed image widths for optimization and srcSet generation. (ascending order) */
  sizes?: number[];
  /** Allowed remote image host patterns. */
  remotePatterns?: VercelRemotePattern[];
  /** Allowed local image path patterns. */
  localPatterns?: VercelLocalPattern[];
  /** Allowed remote image hostnames (exact match). */
  domains?: string[];
  /** Allowed quality values (1–100). @default [75] */
  qualities?: number[];
  /** Preferred output formats. */
  formats?: Array<"image/avif" | "image/webp" | "image/jpeg" | "image/png">;
  /** Minimum cache TTL in seconds. */
  minimumCacheTTL?: number;
  /** Allow SVG optimization. @default false */
  dangerouslyAllowSVG?: boolean;
  contentDispositionType?: "inline" | "attachment";
  contentSecurityPolicy?: string;
}

/** Vercel's image optimization: `<Image>`'s provider, and the `images` config of the build output */
export function vercelImage<C extends WakuAppShape = WakuAppShape>(
  options: VercelImageOptions = {},
): WakuPlugin<C, { provides: "image" }> {
  const config = resolveVercelImageConfig(options);

  return {
    name: "vercel-image",
    provides: ["image"],
    slots: ({ page }) =>
      page
        ? undefined
        : [
            {
              slot: "layout.wrapper",
              component: VercelImageProvider,
              props: { config },
              order: -1,
            },
          ],
    waku: {
      unstable_serverEntry(entry) {
        if (!import.meta.env.PROD) return entry;
        return {
          ...entry,
          buildEnhancers: [
            ...(entry.buildEnhancers ?? []),
            "fumapress/plugins/image/vercel.enhancer",
          ],
          buildOptions: { ...entry.buildOptions, FUMAPRESS_IMAGE_CONFIG: config },
        };
      },
    },
  };
}
