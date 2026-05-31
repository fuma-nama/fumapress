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

type SupportedFormat = "image/jpeg" | "image/png" | "image/webp" | "image/avif";

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
  body: ArrayBuffer,
  options: { width: number; format: SupportedFormat; quality: number },
) => Promise<{ body: Buffer }>;

interface OptimizeResult {
  body: Uint8Array<ArrayBuffer>;
  contentType: SupportedFormat;
}

interface CachedImage {
  body: ArrayBuffer;
  policy: CachePolicy;
  optimized: Map<string, OptimizeResult>;
}

export class ImageOptimizationCache {
  private readonly store = new Map<string, CachedImage>();

  private getEntry(src: string): CachedImage | null {
    const entry = this.store.get(src);
    if (!entry) return null;

    if (entry.policy.timeToLive() <= 0) {
      this.store.delete(src);
      return null;
    }

    return entry;
  }

  getSource(src: string): Pick<CachedImage, "body" | "policy"> | null {
    const entry = this.getEntry(src);
    if (!entry) return null;

    return { body: entry.body, policy: entry.policy };
  }

  getOptimized(
    src: string,
    optimizeKey: string,
  ): (OptimizeResult & { policy: CachePolicy }) | null {
    const entry = this.getEntry(src);
    if (!entry) return null;

    const optimized = entry.optimized.get(optimizeKey);
    if (!optimized) return null;

    return { ...optimized, policy: entry.policy };
  }

  setSource(src: string, body: ArrayBuffer, policy: CachePolicy): void {
    if (!policy.storable() || policy.timeToLive() <= 0) return;

    this.store.set(src, {
      body,
      policy,
      optimized: new Map(),
    });
  }

  setOptimized(
    src: string,
    optimizeKey: string,
    body: Uint8Array<ArrayBuffer>,
    contentType: SupportedFormat,
  ): void {
    const entry = this.getEntry(src);
    if (!entry) return;

    entry.optimized.set(optimizeKey, { body, contentType });
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

export function getOptimizeCacheKey(params: ParsedImageParams, format: SupportedFormat): string {
  return `${params.width}\0${params.quality}\0${format}`;
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

      const transformer: ImageTransformer = async (body, { width, format, quality }) => {
        let pipeline = sharp(body);

        if (width > 0) {
          pipeline = pipeline.resize(width, undefined, {
            fit: "inside",
            withoutEnlargement: true,
          });
        }

        switch (format) {
          case "image/avif":
            pipeline = pipeline.avif({ quality });
            return { body: await pipeline.toBuffer() };
          case "image/webp":
            pipeline = pipeline.webp({ quality });
            return { body: await pipeline.toBuffer() };
          case "image/png":
            pipeline = pipeline.png({ quality });
            return { body: await pipeline.toBuffer() };
          default:
            pipeline = pipeline.jpeg({ quality, mozjpeg: true });
            return { body: await pipeline.toBuffer() };
        }
      };

      const cache = import.meta.env.DEV ? undefined : new ImageOptimizationCache();

      createApi({
        render: "dynamic",
        path: config.path,
        handlers: {
          async GET(req) {
            return handleImageOptimization(req, config, transformer, cache);
          },
        },
      });
    },
  };
}

function negotiateImageFormat(acceptHeader: string | null): SupportedFormat {
  if (!acceptHeader) return "image/jpeg";
  if (acceptHeader.includes("image/avif")) return "image/avif";
  if (acceptHeader.includes("image/webp")) return "image/webp";
  if (acceptHeader.includes("image/png")) return "image/png";
  return "image/jpeg";
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

export async function handleImageOptimization(
  request: Request,
  config: ResolvedImageConfig,
  transformImage: ImageTransformer,
  cache?: ImageOptimizationCache,
): Promise<Response> {
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
  const format = negotiateImageFormat(request.headers.get("Accept"));
  const optimizeKey = getOptimizeCacheKey(params, format);

  const optimized = cache?.getOptimized(sourceUrl, optimizeKey);
  if (optimized) {
    return createOptimizedImageResponse(optimized.body, optimized.contentType, optimized.policy);
  }

  let sourceBody: ArrayBuffer;
  let sourcePolicy: CachePolicy;

  const fetched = cache?.getSource(sourceUrl);
  if (fetched) {
    sourceBody = fetched.body;
    sourcePolicy = fetched.policy;
  } else {
    // TODO: use hono.fetch() for relative `src` when Waku.js exposes it
    // for now, it can fetch anything as the server itself, this assumes "request.url" always has a public hostname like "api.acme.com", which cannot resolve to other private services under the same host/server
    const source = await fetch(sourceUrl, {
      headers: {
        Accept: "image/*",
        "X-Fumapress": "image-optimization",
      },
      signal: AbortSignal.timeout(config.fetchTimeout),
      redirect: "error",
    });
    if (!source.ok || !source.body) {
      return new Response("Image not found", { status: 404 });
    }

    const sourceContentType = source.headers.get("Content-Type");
    if (!isSafeImageContentType(sourceContentType)) {
      return new Response("The requested resource is not an allowed image type", { status: 400 });
    }

    const body = await readResponseBodyWithLimit(source, config.maxSourceSize);
    if (body === "too-large") {
      return new Response("Source image is too large", { status: 413 });
    }

    sourcePolicy = createSourceCachePolicy(sourceUrl, source);
    sourceBody = body;
    cache?.setSource(sourceUrl, sourceBody, sourcePolicy);
  }

  try {
    const transformed = await transformImage(sourceBody, {
      width: params.width,
      format,
      quality: params.quality,
    });

    const optimizedBody = new Uint8Array(transformed.body);
    cache?.setOptimized(sourceUrl, optimizeKey, optimizedBody, format);

    return createOptimizedImageResponse(optimizedBody, format, sourcePolicy);
  } catch (error) {
    console.error("[Fumapress] Image optimization error:", error);
    return new Response("Failed to optimize image", { status: 500 });
  }
}

function createOptimizedImageResponse(
  body: Uint8Array<ArrayBuffer>,
  contentType: SupportedFormat,
  policy?: CachePolicy,
): Response {
  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Vary", "Accept");
  headers.set("Content-Security-Policy", "script-src 'none'; frame-src 'none'; sandbox;");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Disposition", "inline");

  if (policy?.storable()) {
    for (const [key, value] of Object.entries(policy.responseHeaders())) {
      headers.set(key, value as never);
    }
  }

  return new Response(body, { status: 200, headers });
}
