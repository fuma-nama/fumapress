import { type ResolvedImageConfig, isPrivateIp, hasAllowedHost } from "./config";

/** check if the src (URL) is allowed */
export function validateImageSrc(
  src: URL,
  config: ResolvedImageConfig,
): { allowed: boolean; reason?: string } {
  if (src.protocol !== "http:" && src.protocol !== "https:") {
    return { allowed: false, reason: `Invalid image URL protocol: ${src}` };
  }

  if (!config.dangerouslyAllowLocalIP && isPrivateIp(src.hostname)) {
    return {
      allowed: false,
      reason: `Image URL "${src}" uses a private IP address`,
    };
  }

  if (!hasAllowedHost(config.allowedHosts, src)) {
    return {
      allowed: false,
      reason: `Image URL "${src}" is not in allowedHosts`,
    };
  }

  return { allowed: true };
}
