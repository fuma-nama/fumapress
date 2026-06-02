"use client";
import { useRouter } from "@/client";
import type { ComponentProps, ReactNode, TransitionFunction } from "react";
import { Link as BaseLink } from "waku/router/client";

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
}

export function Link({ href = "#", children, ...props }: LinkProps) {
  global.LINK_SSG_CONTEXT?.links.push({ href, fromPathname: useRouter().path });

  return (
    <BaseLink to={href} {...props}>
      {children}
    </BaseLink>
  );
}
