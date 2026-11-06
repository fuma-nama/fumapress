import type { WakuAppShape, WakuPlugin } from "@/press";
import { SelfHostedImageProvider } from "./self-hosted.client";
import { createImageOptimizer, ImageOptimizationCache } from "./self-hosted.utils";
import { resolveImageConfig } from "./self-hosted.shared";

export interface RemotePattern {
  protocol?: "http" | "https";
  hostname: RegExp;
  pathname?: RegExp;
  port?: string;
}

export interface SelfHostedImageOptions {
  /** Image optimization endpoint path. @default "/_img" */
  path?: string;
  /** Allowed remote hostnames (exact match) or patterns, should be only **trusted** hosts. */
  allowedHosts?: Array<string | RemotePattern>;
  /** Possible viewport widths for srcSet generation. (ascending order) */
  deviceSizes?: number[];
  /** Possible image widths for srcSet generation. (ascending order) */
  imageSizes?: number[];
  /** Default optimization quality (1–100). @default 75 */
  quality?: number;

  /** timeout to fetch images (ms) @default 4000 */
  fetchTimeout?: number;
  /** Max source image bytes fetched for optimization. @default 64_000_000 (~64 MB) */
  maxSourceSize?: number;
}

/** an on-demand optimizer route with `sharp`, so the site needs a server and `site.baseUrl`, where its images are. Without them images are served as they are */
export function selfHostedImage<C extends WakuAppShape = WakuAppShape>(
  options: SelfHostedImageOptions = {},
): WakuPlugin<C, { provides: "image" }> {
  const config = resolveImageConfig(options);

  return {
    name: "self-hosted-image",
    provides: ["image"],
    slots({ page }) {
      if (page || !this.siteConfig.baseUrl) return;
      return [
        {
          slot: "layout.wrapper",
          component: SelfHostedImageProvider,
          props: { config },
          order: -1,
        },
      ];
    },
    routes({ createApi }) {
      const { baseUrl } = this.siteConfig;
      if (!baseUrl) return;
      const optimizer = createImageOptimizer(
        config,
        // the dev server has its own port, and `baseUrl` may be the deployed site
        import.meta.env.DEV ? undefined : baseUrl,
        import.meta.env.DEV ? undefined : new ImageOptimizationCache(),
      );
      createApi({ path: config.path, GET: optimizer });
    },
  };
}
