export interface RemotePattern {
  protocol?: "http" | "https";
  hostname: RegExp;
  pathname?: RegExp;
  port?: string;
}

export interface ImageConfig {
  /** Image optimization endpoint path. @default "/_img" */
  path?: string;
  /** Allowed remote hostnames (exact match) or patterns. */
  allowedHosts?: Array<string | RemotePattern>;
  /** Responsive widths for srcSet generation. */
  deviceSizes?: number[];
  /** Default optimization quality (1–100). @default 75 */
  quality?: number;
  /** Allow remote URLs with private IP hostnames. @default false */
  dangerouslyAllowLocalIP?: boolean;
}

export type ResolvedImageConfig = Required<ImageConfig>;

const DEFAULT_DEVICE_SIZES = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];
const DEFAULT_IMAGE_PATH = "/_img";
const DEFAULT_QUALITY = 75;

export function resolveImageConfig(options: ImageConfig = {}): ResolvedImageConfig {
  return {
    path: options.path ?? DEFAULT_IMAGE_PATH,
    allowedHosts: options.allowedHosts ?? [],
    deviceSizes: options.deviceSizes ?? DEFAULT_DEVICE_SIZES,
    quality: options.quality ?? DEFAULT_QUALITY,
    dangerouslyAllowLocalIP: options.dangerouslyAllowLocalIP ?? false,
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

/** Best-effort guard for literal IP hostnames in remote image URLs. */
export function isPrivateIp(hostname: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;

  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }

  const lower = hostname.toLowerCase();
  if (lower === "::1") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;

  return false;
}
