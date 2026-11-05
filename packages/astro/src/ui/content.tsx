"use client";
import { createContext, use, type ComponentProps, type ReactNode } from "react";
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

const LinksContext = createContext<Map<string, string> | undefined>(undefined);

/**
 * The MDX components of a collection, the content renders in `ContentProvider` with the `provider` prop of `<Content />`.
 *
 * They also render in the browser, without the loader: the `links` prop has the URLs of relative links from the server.
 */
export function withProvider(components: MDXComponents): MDXComponents {
  const { wrapper: Wrapper, a: A = Link } = components;

  return {
    ...components,
    a({ href, ...props }: ComponentProps<"a">) {
      const url = href && use(LinksContext)?.get(href);
      return <A {...props} href={url || href} />;
    },
    wrapper({
      provider,
      links,
      children,
      ...props
    }: {
      provider?: ProviderData;
      links?: Map<string, string>;
      children?: ReactNode;
    }) {
      const content = (
        <LinksContext value={links}>
          {Wrapper ? <Wrapper {...props}>{children}</Wrapper> : children}
        </LinksContext>
      );
      return provider ? <ContentProvider provider={provider}>{content}</ContentProvider> : content;
    },
  };
}
