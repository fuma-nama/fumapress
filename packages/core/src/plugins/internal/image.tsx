import type { ServerPlugin } from "@/lib/types";
import { type ResolvedImageConfig, validateImageSrc } from "@/lib/shared/image";
import type { ConfigContext } from "@/config";
import sharp from "sharp";
import { ConfigProvider } from "@/components/image";
import CachePolicy from "http-cache-semantics";

const SAFE_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/bmp",
  "image/tiff",
]);

interface ParsedImageParams {
  src: string;
  width: number;
  quality: number;
}

export function parseImageParams(url: URL, config: ResolvedImageConfig): ParsedImageParams | null {
  const src = url.searchParams.get("src");
  if (!src) return null;

  const width = parseInt(url.searchParams.get("width") ?? "0", 10);
  const quality = parseInt(url.searchParams.get("quality") ?? String(config.quality), 10);

  if (Number.isNaN(width) || width < 0) return null;
  if (!config.deviceSizes.includes(width) && !config.imageSizes.includes(width)) return null;
  if (Number.isNaN(quality) || quality < 1 || quality > 100) return null;
  return { src, width, quality };
}

type ImageTransformer = (
  input: FetchSourceResult,
  options: { width: number; quality: number },
) => Promise<OptimizeResult>;

interface OptimizeResult {
  body: Uint8Array<ArrayBuffer>;
  contentType: string;
}

interface FetchSourceResult {
  body: ArrayBuffer;
  policy: CachePolicy;
  contentType: string | null;
}

interface CacheEntry extends FetchSourceResult {
  optimized: Map<string, OptimizeResult>;
}

export class ImageOptimizationCache {
  private readonly store = new Map<string, CacheEntry>();

  readCache(src: string, req?: CachePolicy.HttpRequest): CacheEntry | null {
    const entry = this.store.get(src);
    if (!entry) return null;

    if (!req || entry.policy.satisfiesWithoutRevalidation(req)) {
      return entry;
    }

    this.store.delete(src);
    return null;
  }

  set(src: string, result: FetchSourceResult): CacheEntry | null {
    const { policy } = result;
    if (!policy.storable() || policy.timeToLive() <= 0) return null;
    const entry = {
      ...result,
      optimized: new Map(),
    };

    this.store.set(src, entry);
    return entry;
  }
}

export function createSourceCachePolicy(sourceUrl: string, response: Response): CachePolicy {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  return new CachePolicy(
    {
      url: sourceUrl,
      method: "GET",
      headers: { accept: "image/*" },
    },
    {
      status: response.status,
      headers,
    },
  );
}

export function getOptimizeCacheKey(params: ParsedImageParams): string {
  return `${params.width}\0${params.quality}`;
}

export function imagePlugin<C extends ConfigContext = ConfigContext>(
  config: ResolvedImageConfig,
): ServerPlugin<C> {
  return {
    name: "core:image",
    init() {
      const hooks = (this.data["core:provider"] ??= []);
      hooks.push((props) => {
        props.children = <ConfigProvider config={config}>{props.children}</ConfigProvider>;
        return props;
      });
    },
    createPages({ createApi }) {
      if (this.mode === "static") {
        throw new Error(
          "[Fumapress] Image Optimization is not compatible with static mode, please disable it",
        );
      }

      const transformer: ImageTransformer = async (input, { width, quality }) => {
        let pipeline = sharp(input.body);

        if (width > 0) {
          pipeline = pipeline.resize(width, undefined, {
            fit: "inside",
            withoutEnlargement: true,
          });
        }

        switch (input.contentType) {
          case "image/avif":
            pipeline = pipeline.avif({ quality });
            return { body: new Uint8Array(await pipeline.toBuffer()), contentType: "image/avif" };
          case "image/png":
            pipeline = pipeline.png({ quality });
            return { body: new Uint8Array(await pipeline.toBuffer()), contentType: "image/png" };
          case "image/jpeg":
          case "image/jpg":
            pipeline = pipeline.jpeg({ quality, mozjpeg: true });
            return { body: new Uint8Array(await pipeline.toBuffer()), contentType: "image/jpg" };
          default:
            pipeline = pipeline.webp({ quality });
            return { body: new Uint8Array(await pipeline.toBuffer()), contentType: "image/webp" };
        }
      };

      const optimizer = createImageOptimizer(
        config,
        transformer,
        import.meta.env.DEV ? undefined : new ImageOptimizationCache(),
      );

      createApi({
        render: "dynamic",
        path: config.path,
        handlers: {
          GET: optimizer,
        },
      });
    },
  };
}

function isSafeImageContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const mediaType = contentType.split(";")[0]!.trim().toLowerCase();
  return SAFE_IMAGE_CONTENT_TYPES.has(mediaType);
}

export async function readResponseBodyWithLimit(
  response: Response,
  maxBytes: number,
): Promise<ArrayBuffer | "too-large"> {
  const contentLength = response.headers.get("Content-Length");
  if (contentLength !== null) {
    const length = Number(contentLength);
    if (!Number.isNaN(length) && length > maxBytes) return "too-large";
  }

  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      total += value.byteLength;
      if (total > maxBytes) return "too-large";

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return body.buffer;
}

export function createImageOptimizer(
  config: ResolvedImageConfig,
  transformer: ImageTransformer,
  cache?: ImageOptimizationCache,
) {
  async function fetchSource(
    sourceUrl: string,
    accept: string | null,
  ): Promise<CacheEntry | FetchSourceResult | Response> {
    const requestHeaders: Record<string, string> = {
      "X-Fumapress": "image-optimization",
    };
    if (accept) requestHeaders.Accept = accept;

    const cachePolicyRequest: CachePolicy.Request = {
      url: sourceUrl,
      method: "GET",
      headers: requestHeaders,
    };

    const cached = cache?.readCache(sourceUrl, cachePolicyRequest);
    if (cached) return cached;

    // TODO: use hono.fetch() for relative `src` when Waku.js exposes it
    // for now, it can fetch anything as the server itself, this assumes "request.url" always has a public hostname like "api.acme.com", which cannot resolve to other private services under the same host/server
    const res = await fetch(sourceUrl, {
      headers: requestHeaders,
      signal: AbortSignal.timeout(config.fetchTimeout),
      redirect: "error",
    });
    if (!res.ok || !res.body) {
      return new Response("Image not found", { status: 404 });
    }

    const contentType = res.headers.get("Content-Type");
    if (!isSafeImageContentType(contentType)) {
      return new Response("The requested resource is not an allowed image type", { status: 400 });
    }

    const body = await readResponseBodyWithLimit(res, config.maxSourceSize);
    if (body === "too-large") {
      return new Response("Source image is too large", { status: 413 });
    }

    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const result: FetchSourceResult = {
      body,
      contentType,
      policy: new CachePolicy(cachePolicyRequest, {
        status: res.status,
        headers,
      }),
    };

    return cache?.set(sourceUrl, result) ?? result;
  }

  function createOptimizedImageResponse(result: OptimizeResult, policy?: CachePolicy): Response {
    const headers = new Headers();

    if (policy?.storable()) {
      // responseHeaders() is for proxies, but we also convert & optimize the image, only a subset of headers should be inherited
      for (const [key, value] of Object.entries(policy.responseHeaders())) {
        switch (key) {
          case "cache-control":
          case "etag":
          case "last-modified":
          case "vary":
          case "age":
          case "date":
            headers.set(key, value as never);
        }
      }
    }

    headers.set("Content-Type", result.contentType);
    headers.set("Content-Security-Policy", "script- src 'none'; frame-src 'none'; sandbox;");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Content-Disposition", "inline");

    return new Response(result.body, { status: 200, headers });
  }

  return async function onRequest(request: Request): Promise<Response> {
    const requestUrl = new URL(request.url);
    const params = parseImageParams(requestUrl, config);

    if (
      !params ||
      // avoid `src` that resolves to the `/_img` route itself
      request.headers.get("X-Fumapress") === "image-optimization"
    ) {
      return new Response("Bad Request", { status: 400 });
    }

    const validation = validateImageSrc(config, params.src);
    if (!validation.allowed) {
      return new Response(validation.reason ?? "Forbidden", { status: 403 });
    }

    const sourceUrl = new URL(params.src, requestUrl).href;
    const source = await fetchSource(sourceUrl, request.headers.get("Accept"));
    if (source instanceof Response) return source;

    const optimizeKey = getOptimizeCacheKey(params);
    if ("optimized" in source) {
      const cached = source.optimized.get(optimizeKey);
      if (cached) return createOptimizedImageResponse(cached, source.policy);
    }

    try {
      const transformed = await transformer(source, {
        width: params.width,
        quality: params.quality,
      });

      if ("optimized" in source) {
        source.optimized.set(optimizeKey, transformed);
      }

      return createOptimizedImageResponse(transformed, source.policy);
    } catch (error) {
      console.error("[Fumapress] Image optimization error:", error);
      return new Response("Failed to optimize image", { status: 500 });
    }
  };
}
