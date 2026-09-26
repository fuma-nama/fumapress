"use client";
import { type Framework, FrameworkProvider } from "fumadocs-core/framework";
import { type RootProviderProps, RootProvider } from "fumadocs-ui/provider/base";
import { useMemo } from "react";
import { Image } from "./image";
import { Link, useRouter } from "@/client";
import { withPageTrailingSlash } from "@/lib/pathname";
import { TrailingSlashProvider, useResolveHref } from "./link";

const framework: Framework = {
  useParams() {
    console.warn("[Fumadocs] useParams() is not supported on Fumapress");
    return useMemo(() => ({}), []);
  },
  usePathname() {
    return useRouter().path;
  },
  useRouter() {
    const router = useRouter();
    const resolveHref = useResolveHref();

    return useMemo(
      () => ({
        push: (url) => router.push(resolveHref(url)),
        refresh: router.reload.bind(router),
      }),
      [router, resolveHref],
    );
  },
  Image: ({ priority, ...props }) => (
    <Image
      fetchPriority={priority ? "high" : undefined}
      loading={priority ? "eager" : undefined}
      {...props}
    />
  ),
  Link: ({ prefetch = true, ...props }) => <Link unstable_prefetchOnEnter={prefetch} {...props} />,
};

export interface PressProviderProps extends RootProviderProps {
  /**
   * the language served without URL prefix, the locale switch keeps its URLs unprefixed.
   *
   * Ignored when `i18n.onLocaleChange` is given, your handler owns the navigation then.
   */
  hiddenLocale?: string;

  /** append a trailing slash to internal page links, from `site.trailingSlash` */
  trailingSlash?: boolean;
}

export function PressProvider({
  hiddenLocale,
  trailingSlash = false,
  i18n,
  ...props
}: PressProviderProps) {
  const router = useRouter();

  if (i18n && hiddenLocale && !i18n.onLocaleChange) {
    const { locale } = i18n;
    i18n = {
      ...i18n,
      onLocaleChange(target) {
        const segments = router.path.split("/").filter(Boolean);
        if (segments[0] === locale) segments.shift();
        if (target !== hiddenLocale) segments.unshift(target);
        const pathname = "/" + segments.join("/");
        void router.push(trailingSlash ? withPageTrailingSlash(pathname) : pathname);
      },
    };
  }

  return (
    <TrailingSlashProvider value={trailingSlash}>
      <FrameworkProvider {...framework}>
        <RootProvider {...props} i18n={i18n} />
      </FrameworkProvider>
    </TrailingSlashProvider>
  );
}
