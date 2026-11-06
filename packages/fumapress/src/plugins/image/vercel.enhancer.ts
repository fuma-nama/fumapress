import path from "node:path";
import type { ResolvedVercelImageConfig } from "./vercel.utils";
import type { BuildOptions as BaseBuildOptions } from "waku/adapters/vercel-build-enhancer";
import { readFileSync, writeFileSync } from "node:fs";

export interface BuildOptions extends BaseBuildOptions {
  FUMAPRESS_IMAGE_CONFIG: ResolvedVercelImageConfig;
}

export default async function buildEnhancer(
  build: (utils: unknown, options: BuildOptions) => Promise<void>,
): Promise<typeof build> {
  return async (utils: unknown, options: BuildOptions) => {
    await build(utils, options);

    const configPath = path.resolve(".vercel/output/config.json");

    try {
      const parsed = JSON.parse(readFileSync(configPath, "utf-8"));
      parsed.images ??= options.FUMAPRESS_IMAGE_CONFIG;
      writeFileSync(configPath, JSON.stringify(parsed, null, 2));
    } catch {
      // skip if vercel adapter not configured
    }
  };
}
