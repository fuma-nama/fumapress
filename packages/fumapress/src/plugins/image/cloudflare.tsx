import type { WakuAppShape, WakuPlugin } from "@/press";
import { CloudflareImageProvider } from "./cloudflare.client";
import { resolveCloudflareImageConfig } from "./cloudflare.utils";

/** @see https://developers.cloudflare.com/images/transform-images/transform-via-url/ */
export interface CloudflareImageOptions {
  /** Image transformation path prefix. @default "/cdn-cgi/image" */
  path?: string;
  /** Allowed image widths for optimization and srcSet generation. (ascending order) */
  sizes?: number[];
  /** Allowed quality values (1–100). @default [75] */
  qualities?: number[];
  /** Output format. @default "auto" */
  format?: "auto" | "avif" | "webp" | "jpeg" | "png" | "json";
  /** How the image fits the requested dimensions. */
  fit?: "scale-down" | "contain" | "cover" | "crop" | "pad";
  /** Allow SVG optimization. @default false */
  dangerouslyAllowSVG?: boolean;
}

/** Cloudflare's image transformations: `<Image>`'s provider */
export function cloudflareImage<C extends WakuAppShape = WakuAppShape>(
  options: CloudflareImageOptions = {},
): WakuPlugin<C, { slots: "image:provider" }> {
  const config = resolveCloudflareImageConfig(options);

  return {
    name: "cloudflare-image",
    slots: ({ page }) =>
      page
        ? undefined
        : [
            {
              name: "image:provider",
              region: "layout-wrapper",
              component: CloudflareImageProvider,
              props: { config },
              order: -1,
            },
          ],
  };
}
