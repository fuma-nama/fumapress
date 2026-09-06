"use client";
import { type Framework, FrameworkProvider } from "fumadocs-core/framework";
import { type RootProviderProps, RootProvider } from "fumadocs-ui/provider/base";
import { useMemo } from "react";
import { Image } from "./image";
import { Link, useRouter } from "@/client";

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

    return useMemo(
      () => ({
        push: router.push.bind(router),
        refresh: router.reload.bind(router),
      }),
      [router],
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
  /** the language served without URL prefix, the locale switch keeps its URLs unprefixed */
  hiddenLocale?: string;
}

export function PressProvider({ hiddenLocale, i18n, ...props }: PressProviderProps) {
  const router = useRouter();

  if (i18n && hiddenLocale) {
    const { locale } = i18n;
    i18n = {
      ...i18n,
      onLocaleChange(target) {
        const segments = router.path.split("/").filter(Boolean);
        if (segments[0] === locale) segments.shift();
        if (target !== hiddenLocale) segments.unshift(target);
        void router.push("/" + segments.join("/"));
      },
    };
  }

  return (
    <FrameworkProvider {...framework}>
      <RootProvider {...props} i18n={i18n} />
    </FrameworkProvider>
  );
}
