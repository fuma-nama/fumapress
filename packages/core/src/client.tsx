"use client";
/** tiny wrapper of `waku` */
import { useRouter as useRouterBase } from "waku/router/client";

export { Link, type LinkProps } from "@/components/link";

export interface Router {
  push: (
    to: string,
    options?: {
      /**
       * indicates if the link should scroll or not on navigation
       * - `true`: always scroll
       * - `false`: never scroll
       * - `undefined`: scroll on path/hash change (not on query-only change)
       */
      scroll?: boolean;
    },
  ) => Promise<void>;
  replace: (
    to: string,
    options?: {
      /**
       * indicates if the link should scroll or not on navigation
       * - `true`: always scroll
       * - `false`: never scroll
       * - `undefined`: scroll on path/hash change (not on query-only change)
       */
      scroll?: boolean;
    },
  ) => Promise<void>;
  reload: () => Promise<void>;
  back: () => void;
  forward: () => void;
  prefetch: (to: string) => void;
  path: string;
  query: string;
  hash: string;
}

export function useRouter(): Router {
  return useRouterBase();
}
