import { describe, expect, it } from "vitest";
import {
  hasAllowedHost,
  isPrivateIp,
  matchRemotePattern,
  resolveImageConfig,
} from "@/lib/image/config";
import { _internal } from "@/components/image";
import { parseImageParams } from "@/plugins/internal/image";
import { validateImageSrc } from "@/lib/image/shared";

const { buildImageUrl, generateSrcSet } = _internal;
describe("image config", () => {
  it("matches remote patterns", () => {
    const url = new URL("https://cdn.example.com/assets/photo.jpg");
    expect(matchRemotePattern({ hostname: /cdn\.example\.com/, pathname: /^\/assets/ }, url)).toBe(
      true,
    );
    expect(matchRemotePattern({ hostname: /evil\.com/ }, url)).toBe(false);
  });

  it("checks allowed hosts", () => {
    const url = new URL("https://images.example.com/a.png");
    expect(hasAllowedHost(["images.example.com"], url)).toBe(true);
    expect(hasAllowedHost(["other.example.com"], url)).toBe(false);
  });

  it("detects private IPs", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("example.com")).toBe(false);
  });
});

describe("image optimization params", () => {
  it("parses valid query params", () => {
    const url = new URL("/_img?src=%2Flogo.png&width=640&quality=80", "https://localhost");
    expect(parseImageParams(url, resolveImageConfig())).toEqual({
      src: "/logo.png",
      width: 640,
      quality: 80,
    });
  });

  it("rejects invalid src values", () => {
    const config = resolveImageConfig();
    expect(
      parseImageParams(
        new URL("/_img?src=//evil.com/a.png&width=640", "https://localhost"),
        config,
      ),
    ).toBeNull();
    expect(
      parseImageParams(
        new URL("/_img?src=javascript:alert(1)&width=640", "https://localhost"),
        config,
      ),
    ).toBeNull();
  });

  it("blocks remote src without allowed hosts", () => {
    const result = validateImageSrc("https://cdn.example.com/a.png", resolveImageConfig());
    expect(result.allowed).toBe(false);
  });

  it("allows remote src when host is configured", () => {
    const result = validateImageSrc(
      "https://cdn.example.com/a.png",
      resolveImageConfig({
        allowedHosts: ["cdn.example.com"],
      }),
    );
    expect(result.allowed).toBe(true);
  });
});

describe("Image URLs", () => {
  const config = resolveImageConfig({ path: "/_img", deviceSizes: [640, 1280], quality: 75 });

  it("builds optimization URLs", () => {
    expect(buildImageUrl("/hero.png", 640, 75, config)).toBe(
      "/_img?src=%2Fhero.png&width=640&quality=75",
    );
  });

  it("generates srcset entries", () => {
    const srcSet = generateSrcSet("/hero.png", 1280, 75, config);
    expect(srcSet).toContain("/_img?src=%2Fhero.png&width=640&quality=75 640w");
    expect(srcSet).toContain("/_img?src=%2Fhero.png&width=1280&quality=75 1280w");
  });
});
