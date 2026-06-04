import { describe, expect, it, vi } from "vitest";
import {
  resolveImageConfig,
  validateImageSrc,
  ImageOptimizationCache,
  getOptimizeCacheKey,
  parseImageParams,
  readResponseBodyWithLimit,
} from "@/plugins/image/self-hosted.utils";
import { generateImageAttributes } from "@/components/image";
import CachePolicy from "http-cache-semantics";
import { createProvider as createCloudflareProvider } from "@/plugins/image/cloudflare.client";
import { resolveCloudflareImageConfig } from "@/plugins/image/cloudflare.utils";
import { createProvider } from "@/plugins/image/self-hosted.client";

const sourceUrl = "https://example.com/hero.png";
const cacheRequest = {
  url: sourceUrl,
  method: "GET" as const,
  headers: { accept: "image/*" },
};

function createFetchResult(cacheControl: string, body = new Uint8Array([1, 2, 3]).buffer) {
  return {
    body,
    contentType: "image/jpeg",
    policy: new CachePolicy(
      { url: sourceUrl, method: "GET", headers: { accept: "image/*" } },
      {
        status: 200,
        headers: {
          "cache-control": cacheControl,
          date: "Wed, 01 Jan 2026 00:00:00 GMT",
        },
      },
    ),
  };
}
describe("image optimization params", () => {
  it("parses valid query params", () => {
    const url = new URL("/_img?src=%2Flogo.png&width=640&quality=80", "https://localhost");
    expect(parseImageParams(url, resolveImageConfig())).toEqual({
      src: "/logo.png",
      width: 640,
      quality: 80,
    });
  });

  it("matches remote patterns", () => {
    const url = "https://cdn.example.com/assets/photo.jpg";
    expect(
      validateImageSrc(
        resolveImageConfig({
          allowedHosts: [{ hostname: /cdn\.example\.com/, pathname: /^\/assets/ }],
        }),
        url,
      ).allowed,
    ).toBe(true);
    expect(
      validateImageSrc(resolveImageConfig({ allowedHosts: [{ hostname: /evil\.com/ }] }), url)
        .allowed,
    ).toBe(false);
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
  it("stores source entries with an empty optimize map", () => {
    const cache = new ImageOptimizationCache();
    const result = createFetchResult("public, max-age=60");

    const entry = cache.set(sourceUrl, result);

    expect(entry).toEqual({
      ...result,
      optimized: new Map(),
    });
    expect(cache.readCache(sourceUrl, cacheRequest)).toBe(entry);
  });

  it("invalidates source and nested optimize entries together", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const cache = new ImageOptimizationCache();
    const optimizeKey = getOptimizeCacheKey({ src: "/hero.png", width: 640, quality: 75 });
    const entry = cache.set(sourceUrl, createFetchResult("public, max-age=60"))!;
    entry.optimized.set(optimizeKey, {
      body: new Uint8Array([4, 5, 6]),
      contentType: "image/jpeg",
    });

    expect(cache.readCache(sourceUrl, cacheRequest)?.optimized.get(optimizeKey)).toEqual({
      body: new Uint8Array([4, 5, 6]),
      contentType: "image/jpeg",
    });

    vi.advanceTimersByTime(60_000);
    expect(cache.readCache(sourceUrl, cacheRequest)).toBeNull();

    vi.useRealTimers();
  });

  it("keeps multiple optimize variants on the same source entry", () => {
    const cache = new ImageOptimizationCache();
    const entry = cache.set(sourceUrl, createFetchResult("public, max-age=60"))!;
    const key640 = getOptimizeCacheKey({ src: "/hero.png", width: 640, quality: 75 });
    const key1280 = getOptimizeCacheKey({ src: "/hero.png", width: 1280, quality: 75 });

    entry.optimized.set(key640, { body: new Uint8Array([2]), contentType: "image/jpeg" });
    entry.optimized.set(key1280, { body: new Uint8Array([3]), contentType: "image/jpeg" });

    const cached = cache.readCache(sourceUrl, cacheRequest);
    expect(cached?.body).toBe(entry.body);
    expect(cached?.optimized.get(key640)?.body).toEqual(new Uint8Array([2]));
    expect(cached?.optimized.get(key1280)?.body).toEqual(new Uint8Array([3]));
  });

  it("builds optimize keys from width and quality", () => {
    expect(getOptimizeCacheKey({ src: "/hero.png", width: 640, quality: 75 })).toBe(
      `640${String.fromCharCode(0)}75`,
    );
    expect(getOptimizeCacheKey({ src: "/hero.png", width: 1280, quality: 75 })).not.toBe(
      getOptimizeCacheKey({ src: "/hero.png", width: 640, quality: 75 }),
    );
  });

  it("does not store no-store or no-cache responses", () => {
    const cache = new ImageOptimizationCache();

    expect(cache.set(sourceUrl, createFetchResult("no-store"))).toBeNull();
    expect(cache.set(sourceUrl, createFetchResult("no-cache"))).toBeNull();
    expect(cache.readCache(sourceUrl, cacheRequest)).toBeNull();
  });
});

describe("Cloudflare image URLs", () => {
  it("builds cdn-cgi transformation URLs", () => {
    const provider = createCloudflareProvider(resolveCloudflareImageConfig({ qualities: [80] }));

    expect(provider.buildImageUrl({ src: "/hero.png", width: 640, quality: 80 })).toBe(
      "/cdn-cgi/image/width=640,quality=80,format=auto/hero.png",
    );
    expect(
      provider.buildImageUrl({
        src: "https://cdn.example.com/photo.jpg",
        width: 1280,
        quality: 80,
      }),
    ).toBe(
      "/cdn-cgi/image/width=1280,quality=80,format=auto/https://cdn.example.com/photo.jpg",
    );
  });
});

describe("Image URLs", () => {
  it("generates srcset entries", () => {
    expect(
      generateImageAttributes(
        createProvider(resolveImageConfig({ deviceSizes: [640, 1280], quality: 80 })),
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
        createProvider(resolveImageConfig({ quality: 80 })),
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
