"use client";
import type { ReactNode } from "react";
import type { MDXComponents } from "mdx/types";
import { navigate } from "astro:transitions/client";
import type { Framework } from "fumadocs-core/framework";
import { RootProvider, type RootProviderProps } from "fumadocs-ui/provider/astro";
import { ContentLink, toHref } from "./link";
import type { SearchEngine } from "./search";

/*
 * Compiled MDX imports this module through the MDX components, it never imports the layout module or the runtime.
 */

/** the props of providers from the server, see `getProviderData()` */
export interface ProviderData extends Pick<RootProviderProps, "pathname" | "params" | "i18n"> {
  /** the engine of the default search dialog, search is disabled without it */
  search?: SearchEngine;
}

/** page URLs have no base path */
function go(url: string) {
  return navigate(toHref(url));
}

/** the props of `RootProvider` from the data of the server, `Link` adds the base path */
export function rootProps(
  { pathname, params, i18n }: ProviderData,
  Link: Framework["Link"],
): Omit<RootProviderProps, "children"> {
  return { pathname, params, i18n, navigate: go, components: { Link } };
}

/**
 * For islands of the content, they are React trees of their own: without the theme and search of layouts.
 */
export function ContentProvider({
  provider,
  children,
}: {
  provider: ProviderData;
  children: ReactNode;
}) {
  return (
    <RootProvider
      {...rootProps(provider, ContentLink)}
      theme={{ enabled: false }}
      search={{ enabled: false }}
    >
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
