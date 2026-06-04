import type { CloudflareImageOptions } from "./cloudflare";

export interface ResolvedCloudflareImageConfig {
  path: string;
  sizes: number[];
  qualities: number[];
  defaultQuality: number;
  format: NonNullable<CloudflareImageOptions["format"]>;
  fit?: CloudflareImageOptions["fit"];
  dangerouslyAllowSVG: boolean;
}

export function resolveCloudflareImageConfig(
  options: CloudflareImageOptions = {},
): ResolvedCloudflareImageConfig {
  const qualities = options.qualities ?? [75];

  return {
    path: options.path ?? "/cdn-cgi/image",
    dangerouslyAllowSVG: options.dangerouslyAllowSVG ?? false,
    format: options.format ?? "auto",
    fit: options.fit,
    sizes: options.sizes
      ? options.sizes.sort((a, b) => a - b)
      : [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    qualities,
    defaultQuality: Math.max(...qualities),
  };
}
