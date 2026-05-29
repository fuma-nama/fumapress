import type { ResolvedImageConfig } from "./lib/image/config";

declare global {
  declare const __FUMAPRESS_IMAGE_CONFIG__: ResolvedImageConfig | undefined;
}
