import type { PressPlugin } from "@/app/plugin";
import type { AppShape } from "@/app/context";
import type { PressProviderProps } from "@/components/provider";
import { SelfHostedImageProvider } from "./self-hosted.client";
import {
  createImageOptimizer,
  ImageOptimizationCache,
  resolveImageConfig,
} from "./self-hosted.utils";

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

export function imagePlugin<C extends AppShape = AppShape>(
  _options: SelfHostedImageOptions = {},
): PressPlugin<C> {
  const config = resolveImageConfig(_options);

  return {
    name: "image:self-hosted",
    init() {
      const data = (this.data["core:provider"] ??= {});
      const transformers = (data.transformers ??= []);
      transformers.push((props: PressProviderProps) => {
        props.children = (
          <SelfHostedImageProvider config={config}>{props.children}</SelfHostedImageProvider>
        );
        return props;
      });
    },
    createPages({ createApi }) {
      if (this.mode === "static") {
        throw new Error(
          "[Fumapress] Image Optimization is not compatible with static mode, please disable it",
        );
      }

      const optimizer = createImageOptimizer(
        config,
        import.meta.env.DEV ? undefined : new ImageOptimizationCache(),
      );

      createApi({
        render: "dynamic",
        path: config.path,
        handlers: {
          GET: optimizer,
        },
      });
    },
  };
}
