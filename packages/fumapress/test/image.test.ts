import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ImageOptimizationCache,
  createImageOptimizer,
  getOptimizeCacheKey,
  parseImageParams,
  readResponseBodyWithLimit,
} from "@/plugins/image/self-hosted.utils";
import { resolveImageConfig, validateImageSrc } from "@/plugins/image/self-hosted.shared";
import { generateImageAttributes } from "@/components/image";
import CachePolicy from "http-cache-semantics";
import { createProvider as createCloudflareProvider } from "@/plugins/image/cloudflare.client";
import { resolveCloudflareImageConfig } from "@/plugins/image/cloudflare.utils";
import { createProvider } from "@/plugins/image/self-hosted.client";
import { resolveVercelImageConfig } from "@/plugins/image/vercel.utils";

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
    policy: new CachePolicy(cacheRequest, {
      status: 200,
      headers: {
        "cache-control": cacheControl,
        date: "Wed, 01 Jan 2026 00:00:00 GMT",
      },
    }),
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

  const photo = "https://cdn.example.com/assets/photo.jpg";
  const inQuery = (src: string) => `https://localhost/_img?src=${src}&width=640`;

  it.each([
    [
      "allows a matching host and path pattern",
      { allowedHosts: [{ hostname: /cdn\.example\.com/, pathname: /^\/assets/ }] },
      photo,
    ],
    ["allows a configured host", { allowedHosts: ["cdn.example.com"] }, photo],
  ])("%s", (_, options, src) => {
    expect(validateImageSrc(resolveImageConfig(options), src)).toEqual({ allowed: true });
  });

  it.each([
    ["rejects another host pattern", { allowedHosts: [{ hostname: /evil\.com/ }] }, photo],
    ["rejects remote src without allowed hosts", undefined, photo],
    ["rejects a protocol-relative src", undefined, inQuery("//evil.com/a.png")],
    ["rejects a javascript: src", undefined, inQuery("javascript:alert(1)")],
  ])("%s", (_, options, src) => {
    expect(validateImageSrc(resolveImageConfig(options), src)).toEqual({
      allowed: false,
      reason: `Image URL "${src}" is not in allowedHosts`,
    });
  });
});

describe("readResponseBodyWithLimit", () => {
  it.each([
    ["while streaming", new Uint8Array(10), {}],
    ["when Content-Length exceeds the limit", null, { "Content-Length": "10" }],
  ])("rejects bodies larger than the limit %s", async (_, body, headers) => {
    expect(await readResponseBodyWithLimit(new Response(body, { headers }), 5)).toBe("too-large");
  });

  it("reads bodies within the limit", async () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    const body = await readResponseBodyWithLimit(new Response(data), 64);
    if (body === "too-large") throw new Error("unexpected");
    expect(new Uint8Array(body)).toEqual(data);
  });
});

describe("image cache", () => {
  const optimizeKey = (width: number) =>
    getOptimizeCacheKey({ src: "/hero.png", width, quality: 75 });

  it("stores source entries with an empty optimize map", () => {
    const cache = new ImageOptimizationCache();
    const result = createFetchResult("public, max-age=60");
    const entry = cache.set(sourceUrl, result);

    expect(entry).toEqual({ ...result, optimized: new Map() });
    expect(cache.readCache(sourceUrl, cacheRequest)).toBe(entry);
  });

  it("keeps optimize variants on the source entry, invalidating them together", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const cache = new ImageOptimizationCache();
    const entry = cache.set(sourceUrl, createFetchResult("public, max-age=60"))!;
    const small = { body: new Uint8Array([2]), contentType: "image/jpeg" };
    const large = { body: new Uint8Array([3]), contentType: "image/jpeg" };
    entry.optimized.set(optimizeKey(640), small);
    entry.optimized.set(optimizeKey(1280), large);

    const cached = cache.readCache(sourceUrl, cacheRequest);
    expect(cached?.body).toBe(entry.body);
    expect(cached?.optimized.get(optimizeKey(640))).toEqual(small);
    expect(cached?.optimized.get(optimizeKey(1280))).toEqual(large);

    vi.advanceTimersByTime(60_000);
    expect(cache.readCache(sourceUrl, cacheRequest)).toBeNull();

    vi.useRealTimers();
  });

  it("builds optimize keys from width and quality", () => {
    expect(optimizeKey(640)).toBe(`640${String.fromCharCode(0)}75`);
    expect(optimizeKey(1280)).toBe(`1280${String.fromCharCode(0)}75`);
  });

  it("does not store no-store or no-cache responses", () => {
    const cache = new ImageOptimizationCache();

    expect(cache.set(sourceUrl, createFetchResult("no-store"))).toBeNull();
    expect(cache.set(sourceUrl, createFetchResult("no-cache"))).toBeNull();
    expect(cache.readCache(sourceUrl, cacheRequest)).toBeNull();
  });
});

describe("Cloudflare image URLs", () => {
  it.each([
    ["/hero.png", 640, "/cdn-cgi/image/width=640,quality=80,format=auto/hero.png"],
    [
      "https://cdn.example.com/photo.jpg",
      1280,
      "/cdn-cgi/image/width=1280,quality=80,format=auto/https://cdn.example.com/photo.jpg",
    ],
  ])("builds cdn-cgi transformation URLs of %s", (src, width, expected) => {
    const provider = createCloudflareProvider(resolveCloudflareImageConfig({ qualities: [80] }));
    expect(provider.buildImageUrl({ src, width, quality: 80 })).toBe(expected);
  });
});

describe("Image URLs", () => {
  it.each([
    [
      "one entry for a requested quality",
      { deviceSizes: [640, 1280], quality: 80 },
      75,
      {
        src: "/_img?src=%2Fhero.png&width=1280&quality=75",
        srcSet: "/_img?src=%2Fhero.png&width=1280&quality=75 1x",
      },
    ],
    [
      "1x and 2x entries with the default quality",
      { quality: 80 },
      undefined,
      {
        src: "/_img?src=%2Fhero.png&width=3840&quality=80",
        srcSet:
          "/_img?src=%2Fhero.png&width=1920&quality=80 1x, /_img?src=%2Fhero.png&width=3840&quality=80 2x",
      },
    ],
  ])("generates srcset: %s", (_, options, quality, expected) => {
    expect(
      generateImageAttributes(
        createProvider(resolveImageConfig(options)),
        "/hero.png",
        quality,
        1280,
        undefined,
      ),
    ).toStrictEqual({ sizes: undefined, ...expected });
  });
});

describe("image optimization redirects", () => {
  /** answer the first request with a redirect to `location`, then a 404 */
  function mockRedirect(location: string) {
    const seen: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      seen.push(String(input));
      return Promise.resolve(
        seen.length === 1
          ? new Response(null, { status: 302, headers: { location } })
          : new Response(null, { status: 404 }),
      );
    });
    return seen;
  }

  /** request `/hero.png` of the deployment itself */
  function optimize(config = resolveImageConfig()) {
    return createImageOptimizer(config)(
      new Request("https://site.example/_img?src=%2Fhero.png&width=640&quality=75"),
    );
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("follows redirects within the site's own origin", async () => {
    const seen = mockRedirect("https://site.example/static/hero.png");
    const res = await optimize();

    expect(seen).toEqual(["https://site.example/hero.png", "https://site.example/static/hero.png"]);
    expect(res.status).toBe(404);
  });

  it("rejects redirects leaving the origin unless allowed", async () => {
    mockRedirect("https://cdn.example/hero.png");
    const res = await optimize();

    expect(res.status).toBe(403);
    expect(await res.text()).toBe(
      'Image URL "https://cdn.example/hero.png" is not in allowedHosts',
    );

    mockRedirect("https://cdn.example/hero.png");
    expect((await optimize(resolveImageConfig({ allowedHosts: ["cdn.example"] }))).status).toBe(
      404,
    );
  });
});

it("keeps the Vercel options written to the build output", () => {
  const options = {
    domains: ["avatars.githubusercontent.com"],
    remotePatterns: [{ hostname: "cdn.example" }],
    localPatterns: [{ pathname: "/assets/**" }],
    formats: ["image/webp" as const],
    minimumCacheTTL: 60,
  };
  expect(resolveVercelImageConfig(options)).toMatchObject(options);
});
