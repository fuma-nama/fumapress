"use client";
/** tiny wrapper of `waku` */
import type { ComponentProps, ReactNode, TransitionFunction } from "react";
import {
  Link as BaseLink,
  type Unstable_ChangeRouteCallback,
  type Unstable_ChangeRouteEvent,
  useRouter as useRouterBase,
} from "waku/router/client";

export interface LinkProps extends ComponentProps<"a"> {
  /**
   * indicates if the link should scroll or not on navigation
   * - `true`: always scroll
   * - `false`: never scroll
   * - `undefined`: scroll on path/hash change (not on query-only change)
   */
  scroll?: boolean;
  unstable_pending?: ReactNode;
  unstable_notPending?: ReactNode;
  unstable_prefetchOnEnter?: boolean;
  unstable_prefetchOnView?: boolean;
  unstable_startTransition?: ((fn: TransitionFunction) => void) | undefined;
  href: string;
}

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
  unstable_events: Record<
    "on" | "off",
    (event: Unstable_ChangeRouteEvent, handler: Unstable_ChangeRouteCallback) => void
  >;
  path: string;
  query: string;
  hash: string;
}

export function Link({ href, children, ...props }: LinkProps) {
  return (
    <BaseLink to={href} {...props}>
      {children}
    </BaseLink>
  );
}

export function useRouter() {
  return useRouterBase() as Router;
}
