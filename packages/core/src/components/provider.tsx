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

export type PressProviderProps = RootProviderProps;

export function PressProvider(props: PressProviderProps) {
  return (
    <FrameworkProvider {...framework}>
      <RootProvider {...props} />
    </FrameworkProvider>
  );
}
