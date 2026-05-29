import { type ResolvedImageConfig, isPrivateIp, hasAllowedHost } from "./config";

export function isRemoteUrl(src: string): boolean {
  return src.startsWith("https://") || src.startsWith("http://");
}

export function validateImageSrc(
  src: string,
  config: ResolvedImageConfig,
): { allowed: boolean; reason?: string } {
  if (!isRemoteUrl(src)) return { allowed: true };

  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return { allowed: false, reason: `Invalid image URL: ${src}` };
  }

  if (!config.dangerouslyAllowLocalIP && isPrivateIp(url.hostname)) {
    return {
      allowed: false,
      reason: `Image URL "${src}" uses a private IP address`,
    };
  }

  if (config.allowedHosts.length === 0) {
    return {
      allowed: false,
      reason: `Remote image "${src}" is not allowed. Configure allowedHosts in imagePlugin()`,
    };
  }

  if (!hasAllowedHost(config.allowedHosts, url)) {
    return {
      allowed: false,
      reason: `Image URL "${src}" is not in allowedHosts`,
    };
  }

  return { allowed: true };
}
