import type { VercelImageOptions } from "./vercel";

export interface ResolvedVercelImageConfig {
  path: string;
  sizes: number[];
  qualities: number[];
  defaultQuality: number;
  dangerouslyAllowSVG: boolean;
}

export function resolveVercelImageConfig(
  options: VercelImageOptions = {},
): ResolvedVercelImageConfig {
  const qualities = options.qualities ?? [75];

  return {
    path: "/_vercel/image",
    dangerouslyAllowSVG: options.dangerouslyAllowSVG ?? false,
    sizes: options.sizes
      ? options.sizes.sort((a, b) => a - b)
      : [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    qualities,
    defaultQuality: Math.max(...qualities),
  };
}
