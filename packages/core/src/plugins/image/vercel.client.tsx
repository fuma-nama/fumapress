"use client";
import { type ClientImageProvider, ImageProvider } from "@/components/image";
import { type ResolvedVercelImageConfig } from "./vercel.utils";
import { type ReactNode, useMemo } from "react";

export function createProvider(config: ResolvedVercelImageConfig): ClientImageProvider {
  return {
    name: "vercel",
    defaultQuality: config.defaultQuality,
    deviceSizes: config.sizes,
    sizes: config.sizes,
    buildImageUrl({ src, width, quality }) {
      const params = new URLSearchParams({
        url: src,
        w: String(width),
        q: String(quality),
      });

      return `${config.path}?${params.toString()}`;
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

export function VercelImageProvider({
  config,
  children,
}: {
  config: ResolvedVercelImageConfig;
  children: ReactNode;
}) {
  return (
    <ImageProvider provider={useMemo(() => createProvider(config), [config])}>
      {children}
    </ImageProvider>
  );
}
