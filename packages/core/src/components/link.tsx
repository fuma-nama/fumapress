"use client";
import { useRouter } from "@/client";
import type { ComponentProps, ReactNode, TransitionFunction } from "react";
import { Link as BaseLink, Unstable_PrefetchOptions } from "waku/router/client";

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
  unstable_prefetchOnEnter?: boolean | Unstable_PrefetchOptions;
  unstable_prefetchOnView?: boolean | Unstable_PrefetchOptions;
  unstable_startTransition?: ((fn: TransitionFunction) => void) | undefined;
}

export function Link({
  href = "#",
  children,
  unstable_prefetchOnEnter,
  unstable_prefetchOnView,
  ...props
}: LinkProps) {
  if (typeof global !== "undefined" && global.LINK_SSG_CONTEXT) {
    global.LINK_SSG_CONTEXT.links.push({ href, fromPathname: useRouter().path });
  }

  return (
    <BaseLink
      to={href}
      unstable_prefetchOnView={
        unstable_prefetchOnView
          ? unstable_prefetchOnView === true
            ? {}
            : unstable_prefetchOnView
          : undefined
      }
      unstable_prefetchOnEnter={
        unstable_prefetchOnEnter
          ? unstable_prefetchOnEnter === true
            ? {}
            : unstable_prefetchOnEnter
          : undefined
      }
      {...props}
    >
      {children}
    </BaseLink>
  );
}
