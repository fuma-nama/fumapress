import type { ServerPlugin } from "@/lib/types";
import type { ResolvedImageConfig } from "@/lib/image/config";
import type { ConfigContext } from "@/config";
import { validateImageSrc } from "@/lib/image/shared";

const IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const IMAGE_CONTENT_SECURITY_POLICY = "script-src 'none'; frame-src 'none'; sandbox;";

const SAFE_IMAGE_CONTENT_TYPES = new Set([
  "image/svg+xml",
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

  if (Number.isNaN(width) || width < 0 || !config.deviceSizes.includes(width)) return null;
  if (Number.isNaN(quality) || quality < 1 || quality > 100) return null;
  return { src, width, quality };
}

type ImageTransformer = (
  body: Buffer,
  options: { width: number; format: string; quality: number },
) => Promise<{ body: Buffer; contentType: string }>;

export function imagePlugin<C extends ConfigContext = ConfigContext>(
  config: ResolvedImageConfig,
): ServerPlugin<C> {
  return {
    name: "core:image",
    createPages({ createApi }) {
      if (this.mode === "static") return;

      createApi({
        render: "dynamic",
        path: config.path,
        handlers: {
          async GET(req) {
            const sharp = (await import("sharp")).default;

            return handleImageOptimization(
              req,
              config,
              async (body, { width, format, quality }) => {
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
                    return { body: await pipeline.toBuffer(), contentType: "image/avif" };
                  case "image/webp":
                    pipeline = pipeline.webp({ quality });
                    return { body: await pipeline.toBuffer(), contentType: "image/webp" };
                  default:
                    pipeline = pipeline.jpeg({ quality, mozjpeg: true });
                    return { body: await pipeline.toBuffer(), contentType: "image/jpeg" };
                }
              },
            );
          },
        },
      });
    },
  };
}

function negotiateImageFormat(acceptHeader: string | null): string {
  if (!acceptHeader) return "image/jpeg";
  if (acceptHeader.includes("image/avif")) return "image/avif";
  if (acceptHeader.includes("image/webp")) return "image/webp";
  return "image/jpeg";
}

function isSafeImageContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const mediaType = contentType.split(";")[0]!.trim().toLowerCase();
  return SAFE_IMAGE_CONTENT_TYPES.has(mediaType);
}

function setImageSecurityHeaders(headers: Headers): void {
  headers.set("Content-Security-Policy", IMAGE_CONTENT_SECURITY_POLICY);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Disposition", "inline");
}

export async function handleImageOptimization(
  request: Request,
  config: ResolvedImageConfig,
  transformImage: ImageTransformer,
): Promise<Response> {
  const url = new URL(request.url);
  const params = parseImageParams(url, config);

  if (!params) {
    return new Response("Bad Request", { status: 400 });
  }

  const resolvedSrc = new URL(params.src, request.url);
  const validation = validateImageSrc(resolvedSrc, config);
  if (!validation.allowed) {
    return new Response(validation.reason ?? "Forbidden", { status: 403 });
  }

  const source = await fetch(resolvedSrc, {
    headers: {
      Accept: "image/*",
    },
  });
  if (!source.ok || !source.body) {
    return new Response("Image not found", { status: 404 });
  }

  const sourceContentType = source.headers.get("Content-Type");
  if (!isSafeImageContentType(sourceContentType)) {
    return new Response("The requested resource is not an allowed image type", { status: 400 });
  }

  const sourceMediaType = sourceContentType?.split(";")[0]!.trim().toLowerCase();
  if (sourceMediaType === "image/svg+xml") {
    const headers = new Headers(source.headers);
    headers.set("Cache-Control", IMAGE_CACHE_CONTROL);
    headers.set("Vary", "Accept");
    setImageSecurityHeaders(headers);
    return new Response(source.body, { status: 200, headers });
  }

  const format = negotiateImageFormat(request.headers.get("Accept"));
  const buffer = Buffer.from(await source.arrayBuffer());

  try {
    const transformed = await transformImage(buffer, {
      width: params.width,
      format,
      quality: params.quality,
    });

    const headers = new Headers();
    headers.set("Content-Type", transformed.contentType);
    headers.set("Cache-Control", IMAGE_CACHE_CONTROL);
    headers.set("Vary", "Accept");
    setImageSecurityHeaders(headers);

    return new Response(new Uint8Array(transformed.body), { status: 200, headers });
  } catch (error) {
    console.error("[Fumapress] Image optimization error:", error);
    const headers = new Headers(source.headers);
    headers.set("Cache-Control", IMAGE_CACHE_CONTROL);
    headers.set("Vary", "Accept");
    setImageSecurityHeaders(headers);
    return new Response(source.body, { status: 200, headers });
  }
}
