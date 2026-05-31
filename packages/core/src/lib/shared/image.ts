export interface RemotePattern {
  protocol?: "http" | "https";
  hostname: RegExp;
  pathname?: RegExp;
  port?: string;
}

export interface ImageConfig {
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

export type ResolvedImageConfig = Required<ImageConfig>;

export function resolveImageConfig(options: ImageConfig = {}): ResolvedImageConfig {
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

export function matchRemotePattern(pattern: RemotePattern, url: URL): boolean {
  if (pattern.protocol !== undefined && pattern.protocol !== url.protocol.replace(/:$/, ""))
    return false;

  if (pattern.port !== undefined && pattern.port !== url.port) return false;
  if (!pattern.hostname.test(url.hostname)) return false;
  if (pattern.pathname && !pattern.pathname.test(url.pathname)) return false;

  return true;
}

export function hasAllowedHost(allowedHosts: Array<string | RemotePattern>, url: URL): boolean {
  return allowedHosts.some((entry) => {
    if (typeof entry === "string") return url.hostname === entry;
    return matchRemotePattern(entry, url);
  });
}

const PATHNAME_SEGMENT_REGEX = /^[A-Za-z0-9\-._~!$&'()*+,;=:@]+$/;

/**
 * Validate the `src` property of image to be optimized.
 *
 * @param src - the src, must be normalized.
 */
export function validateImageSrc(
  config: ResolvedImageConfig,
  src: string,
): { allowed: true } | { allowed: false; reason: string } {
  if (src.startsWith("https://") || src.startsWith("http://")) {
    const resolved = new URL(src);

    if (!hasAllowedHost(config.allowedHosts, resolved)) {
      return {
        allowed: false,
        reason: `Image URL "${src}" is not in allowedHosts`,
      };
    }

    return { allowed: true };
  }

  if (
    src.startsWith("/") &&
    src
      .slice(1)
      .split("/")
      .every((seg) => seg !== "." && seg !== ".." && PATHNAME_SEGMENT_REGEX.test(seg))
  )
    return { allowed: true };

  return { allowed: false, reason: `Image URL "${src}" is not normalized` };
}

/** Either full pathname: `/...` or absolute: `https://...` */
export function normalizeSrc(src: string, basePathname: string): string {
  if (src.startsWith("http://") || src.startsWith("https://")) return src;

  const base = new URL(basePathname, "http://localhost");
  const resolved = new URL(src, base);

  if (resolved.hostname !== base.hostname)
    throw new Error(`The src attribute "${src}" is not a valid relative path`);
  return resolved.pathname;
}
