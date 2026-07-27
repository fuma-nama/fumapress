import type { PressPlugin } from "@/app/plugin";
import type { AppShape } from "@/app/context";
import type { PressProviderProps } from "@/components/provider";
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

export function imagePlugin<C extends AppShape = AppShape>(
  options: CloudflareImageOptions = {},
): PressPlugin<C> {
  const config = resolveCloudflareImageConfig(options);

  return {
    name: "image:cloudflare",
    init() {
      const data = (this.data["core:provider"] ??= {});
      const transformers = (data.transformers ??= []);
      transformers.push((props: PressProviderProps) => {
        props.children = (
          <CloudflareImageProvider config={config}>{props.children}</CloudflareImageProvider>
        );
        return props;
      });
    },
  };
}
