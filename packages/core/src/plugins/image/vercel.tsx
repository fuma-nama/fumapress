import type { PressPlugin } from "@/app/plugin";
import type { AppShape } from "@/app/context";
import type { PressProviderProps } from "@/components/provider";
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

export function imagePlugin<C extends AppShape = AppShape>(
  options: VercelImageOptions = {},
): PressPlugin<C> {
  const config = resolveVercelImageConfig(options);

  return {
    name: "image:vercel",
    init() {
      const data = (this.data["core:provider"] ??= {});
      const transformers = (data.transformers ??= []);
      transformers.push((props: PressProviderProps) => {
        props.children = (
          <VercelImageProvider config={config}>{props.children}</VercelImageProvider>
        );
        return props;
      });
    },
    unstable_onServerEntry(entry) {
      if (import.meta.env.PROD) {
        entry.buildEnhancers ??= [];
        entry.buildOptions ??= {};
        entry.buildOptions.FUMAPRESS_IMAGE_CONFIG = config;
        entry.buildEnhancers.push("fumapress/plugins/image/vercel.enhancer");
      }
      return entry;
    },
  };
}
