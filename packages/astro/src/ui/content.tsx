"use client";
import type { ReactNode } from "react";
import type { MDXComponents } from "mdx/types";
import { navigate } from "astro:transitions/client";
import { RootProvider, type RootProviderProps } from "fumadocs-ui/provider/astro";
import { Link, toHref } from "./link";

/*
 * Compiled MDX imports this module through the MDX components, it never imports the layout module or the runtime.
 */

/** the props of providers from the server, see `getProviderData()` */
export type ProviderData = Pick<RootProviderProps, "pathname" | "params" | "i18n">;

/** page URLs have no base path */
function go(url: string) {
  return navigate(toHref(url));
}

/** the props of `RootProvider` from the data of the server */
export function rootProps({
  pathname,
  params,
  i18n,
}: ProviderData): Omit<RootProviderProps, "children"> {
  return { pathname, params, i18n, navigate: go, components: { Link } };
}

/**
 * For Astro content with React components, like `<Content />` of a collection: without the theme and search of pages.
 */
export function ContentProvider({
  provider,
  children,
}: {
  provider: ProviderData;
  children: ReactNode;
}) {
  return (
    <RootProvider {...rootProps(provider)} theme={{ enabled: false }} search={{ enabled: false }}>
      {children}
    </RootProvider>
  );
}

/** the MDX components of a collection, the content renders in `ContentProvider` with the `provider` prop of `<Content />` */
export function withProvider(components: MDXComponents): MDXComponents {
  const { wrapper: Wrapper } = components;

  return {
    ...components,
    wrapper({ provider, children, ...props }: { provider?: ProviderData; children?: ReactNode }) {
      const content = Wrapper ? <Wrapper {...props}>{children}</Wrapper> : children;
      return provider ? <ContentProvider provider={provider}>{content}</ContentProvider> : content;
    },
  };
}
