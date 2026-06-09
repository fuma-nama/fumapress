"use client";
import { type ClientImageProvider, ImageProvider } from "@/components/image";
import { resolveBaseUrl } from "@/lib/pathname";
import { type ResolvedImageConfig, validateImageSrc } from "./self-hosted.utils";
import { type ReactNode, useMemo } from "react";

export function createProvider(config: ResolvedImageConfig): ClientImageProvider {
  return {
    name: "self-hosted",
    defaultQuality: config.quality,
    deviceSizes: config.deviceSizes,
    sizes: [...config.imageSizes, ...config.deviceSizes].sort((a, b) => a - b),
    buildImageUrl({ src, width, quality }) {
      const params = new URLSearchParams({
        src,
        width: String(width),
        quality: String(quality),
      });

      return `${resolveBaseUrl(import.meta.env.BASE_URL, config.path)}?${params.toString()}`;
    },
    validate(src) {
      if (import.meta.env.DEV) {
        const validation = validateImageSrc(config, src);

        if (!validation.allowed) {
          throw new Error(`[Fumapress] Image src "${src}" is not allowed: ${validation.reason}`);
        }
      }
    },
    canOptimize(src) {
      // do not optimize SVG
      if (src.split("?", 1)[0]!.endsWith(".svg")) {
        return false;
      }

      return true;
    },
  };
}

export function SelfHostedImageProvider({
  config,
  children,
}: {
  config: ResolvedImageConfig;
  children: ReactNode;
}) {
  return (
    <ImageProvider provider={useMemo(() => createProvider(config), [config])}>
      {children}
    </ImageProvider>
  );
}
