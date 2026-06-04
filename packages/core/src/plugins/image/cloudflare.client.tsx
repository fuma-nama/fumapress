"use client";
import { type ClientImageProvider, ImageProvider } from "@/components/image";
import type { ResolvedCloudflareImageConfig } from "./cloudflare.utils";
import { type ReactNode, useMemo } from "react";
import { joinPathname } from "@/lib/pathname";

export function createProvider(config: ResolvedCloudflareImageConfig): ClientImageProvider {
  return {
    name: "cloudflare",
    defaultQuality: config.defaultQuality,
    deviceSizes: config.sizes,
    sizes: config.sizes,
    buildImageUrl({ src, width, quality }) {
      const parts = [`width=${width}`, `quality=${quality}`, `format=${config.format}`];
      if (config.fit) parts.push(`fit=${config.fit}`);
      return joinPathname(config.path, parts.join(","), src);
    },
    canOptimize(src) {
      if (import.meta.env.DEV) return false;

      if (!config.dangerouslyAllowSVG && src.split("?", 1)[0]!.endsWith(".svg")) {
        return false;
      }

      return true;
    },
  };
}

export function CloudflareImageProvider({
  config,
  children,
}: {
  config: ResolvedCloudflareImageConfig;
  children: ReactNode;
}) {
  return (
    <ImageProvider provider={useMemo(() => createProvider(config), [config])}>
      {children}
    </ImageProvider>
  );
}
