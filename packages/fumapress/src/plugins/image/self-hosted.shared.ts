import type { RemotePattern, SelfHostedImageOptions } from "./self-hosted";
import { isFullPathname } from "@/lib/pathname";

export type ResolvedImageConfig = Required<SelfHostedImageOptions>;

export function resolveImageConfig(options: SelfHostedImageOptions = {}): ResolvedImageConfig {
  return {
    path: options.path ?? "/_img",
    allowedHosts: options.allowedHosts ?? [],
    imageSizes: options.imageSizes
      ? options.imageSizes.sort((a, b) => a - b)
      : [16, 32, 48, 64, 96, 128, 256, 384],
    deviceSizes: options.deviceSizes
      ? options.deviceSizes.sort((a, b) => a - b)
      : [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    quality: options.quality ?? 75,
    fetchTimeout: options.fetchTimeout ?? 4000,
    maxSourceSize: options.maxSourceSize ?? 64_000_000,
  };
}

/**
 * Validate the `src` property of image to be optimized.
 *
 * @param src - the src, must be either a pathname `/...` or absolute URL.
 */
export function validateImageSrc(
  config: ResolvedImageConfig,
  src: string,
): { allowed: true } | { allowed: false; reason: string } {
  if (src.startsWith("https://") || src.startsWith("http://")) {
    const resolved = new URL(src);

    const hasAllowedHost = config.allowedHosts.some((entry) => {
      if (typeof entry === "string") return resolved.hostname === entry;
      return matchRemotePattern(entry, resolved);
    });

    if (!hasAllowedHost) {
      return {
        allowed: false,
        reason: `Image URL "${src}" is not in allowedHosts`,
      };
    }

    return { allowed: true };
  }

  if (isFullPathname(src)) return { allowed: true };

  return { allowed: false, reason: `Image URL "${src}" is not normalized` };
}

function matchRemotePattern(pattern: RemotePattern, url: URL): boolean {
  if (pattern.protocol !== undefined && pattern.protocol !== url.protocol.replace(/:$/, ""))
    return false;

  if (pattern.port !== undefined && pattern.port !== url.port) return false;
  if (!pattern.hostname.test(url.hostname)) return false;
  if (pattern.pathname && !pattern.pathname.test(url.pathname)) return false;

  return true;
}
