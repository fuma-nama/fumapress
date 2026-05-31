import { describe, expect, it, vi } from "vitest";
import {
  hasAllowedHost,
  matchRemotePattern,
  resolveImageConfig,
  validateImageSrc,
} from "@/lib/shared/image";
import { buildImageUrl, generateImageAttributes } from "@/components/image";
import {
  ImageOptimizationCache,
  createSourceCachePolicy,
  getOptimizeCacheKey,
  parseImageParams,
  readResponseBodyWithLimit,
} from "@/plugins/internal/image";

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
      validateImageSrc(
        config,
        new URL("/_img?src=//evil.com/a.png&width=640", "https://localhost").href,
      ),
    ).toMatchInlineSnapshot(`
      {
        "allowed": false,
        "reason": "Image URL "https://localhost/_img?src=//evil.com/a.png&width=640" is not in allowedHosts",
      }
    `);
    expect(
      validateImageSrc(
        config,
        new URL("/_img?src=javascript:alert(1)&width=640", "https://localhost").href,
      ),
    ).toMatchInlineSnapshot(`
      {
        "allowed": false,
        "reason": "Image URL "https://localhost/_img?src=javascript:alert(1)&width=640" is not in allowedHosts",
      }
    `);
  });

  it("blocks remote src without allowed hosts", () => {
    const result = validateImageSrc(resolveImageConfig(), "https://cdn.example.com/a.png");
    expect(result.allowed).toBe(false);
  });

  it("allows remote src when host is configured", () => {
    const result = validateImageSrc(
      resolveImageConfig({
        allowedHosts: ["cdn.example.com"],
      }),
      "https://cdn.example.com/a.png",
    );
    expect(result.allowed).toBe(true);
  });
});

describe("readResponseBodyWithLimit", () => {
  it("rejects bodies larger than the limit while streaming", async () => {
    const response = new Response(new Uint8Array(10), {
      headers: { "Content-Type": "image/jpeg" },
    });

    expect(await readResponseBodyWithLimit(response, 5)).toBe("too-large");
  });

  it("rejects when Content-Length exceeds the limit", async () => {
    const response = new Response(null, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": "10",
      },
    });

    expect(await readResponseBodyWithLimit(response, 5)).toBe("too-large");
  });

  it("reads bodies within the limit", async () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    const response = new Response(data, {
      headers: { "Content-Type": "image/jpeg" },
    });

    const body = await readResponseBodyWithLimit(response, 64);
    if (body === "too-large") throw new Error("unexpected");
    expect(new Uint8Array(body)).toEqual(data);
  });
});

describe("image cache", () => {
  it("expires source and nested optimize entries together", () => {
    vi.useFakeTimers();

    const cache = new ImageOptimizationCache();
    const policy = createSourceCachePolicy(
      "https://example.com/hero.png",
      new Response(null, {
        status: 200,
        headers: { "Cache-Control": "public, max-age=60" },
      }),
    );
    const sourceBody = new Uint8Array([1, 2, 3]).buffer;
    const optimizeKey = getOptimizeCacheKey(
      { src: "/hero.png", width: 640, quality: 75 },
      "image/jpeg",
    );
    const optimizedBody = new Uint8Array([4, 5, 6]);

    cache.setSource("/hero.png", sourceBody, policy);
    cache.setOptimized("/hero.png", optimizeKey, optimizedBody, "image/jpeg");

    expect(cache.getSource("/hero.png")).toEqual({ body: sourceBody, policy });
    expect(cache.getOptimized("/hero.png", optimizeKey)).toEqual({
      body: optimizedBody,
      contentType: "image/jpeg",
      policy,
    });

    vi.advanceTimersByTime(60_000);
    expect(cache.getSource("/hero.png")).toBeNull();
    expect(cache.getOptimized("/hero.png", optimizeKey)).toBeNull();

    vi.useRealTimers();
  });

  it("reuses cached source for different optimize keys", () => {
    const cache = new ImageOptimizationCache();
    const policy = createSourceCachePolicy(
      "https://example.com/hero.png",
      new Response(null, {
        status: 200,
        headers: { "Cache-Control": "public, max-age=60" },
      }),
    );
    const sourceBody = new Uint8Array([1]).buffer;

    cache.setSource("/hero.png", sourceBody, policy);
    cache.setOptimized(
      "/hero.png",
      getOptimizeCacheKey({ src: "/hero.png", width: 640, quality: 75 }, "image/jpeg"),
      new Uint8Array([2]),
      "image/jpeg",
    );
    cache.setOptimized(
      "/hero.png",
      getOptimizeCacheKey({ src: "/hero.png", width: 1280, quality: 75 }, "image/jpeg"),
      new Uint8Array([3]),
      "image/jpeg",
    );

    expect(cache.getSource("/hero.png")?.body).toBe(sourceBody);
    expect(
      cache.getOptimized(
        "/hero.png",
        getOptimizeCacheKey({ src: "/hero.png", width: 640, quality: 75 }, "image/jpeg"),
      )?.body,
    ).toEqual(new Uint8Array([2]));
    expect(
      cache.getOptimized(
        "/hero.png",
        getOptimizeCacheKey({ src: "/hero.png", width: 1280, quality: 75 }, "image/jpeg"),
      )?.body,
    ).toEqual(new Uint8Array([3]));
  });

  it("does not cache no-cache responses", () => {
    const policy = createSourceCachePolicy(
      "https://example.com/hero.png",
      new Response(null, {
        status: 200,
        headers: { "Cache-Control": "no-cache" },
      }),
    );
    const cache = new ImageOptimizationCache();

    cache.setSource("/hero.png", new Uint8Array([1]).buffer, policy);
    cache.setOptimized(
      "/hero.png",
      getOptimizeCacheKey({ src: "/hero.png", width: 640, quality: 75 }, "image/jpeg"),
      new Uint8Array([2]),
      "image/jpeg",
    );

    expect(cache.getSource("/hero.png")).toBeNull();
    expect(
      cache.getOptimized(
        "/hero.png",
        getOptimizeCacheKey({ src: "/hero.png", width: 640, quality: 75 }, "image/jpeg"),
      ),
    ).toBeNull();
  });
});

describe("Image URLs", () => {
  it("builds optimization URLs", () => {
    const config = resolveImageConfig({ deviceSizes: [640, 1280] });

    expect(buildImageUrl("/hero.png", 640, 75, config)).toBe(
      "/_img?src=%2Fhero.png&width=640&quality=75",
    );
  });

  it("generates srcset entries", () => {
    expect(
      generateImageAttributes(
        resolveImageConfig({ deviceSizes: [640, 1280], quality: 80 }),
        "/hero.png",
        75,
        1280,
        undefined,
      ),
    ).toMatchInlineSnapshot(`
      {
        "sizes": undefined,
        "src": "/_img?src=%2Fhero.png&width=1280&quality=75",
        "srcSet": "/_img?src=%2Fhero.png&width=1280&quality=75 1x",
      }
    `);

    expect(
      generateImageAttributes(
        resolveImageConfig({ quality: 80 }),
        "/hero.png",
        undefined,
        1280,
        undefined,
      ),
    ).toMatchInlineSnapshot(`
      {
        "sizes": undefined,
        "src": "/_img?src=%2Fhero.png&width=3840&quality=80",
        "srcSet": "/_img?src=%2Fhero.png&width=1920&quality=80 1x, /_img?src=%2Fhero.png&width=3840&quality=80 2x",
      }
    `);
  });
});
