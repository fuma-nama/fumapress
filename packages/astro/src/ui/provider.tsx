"use client";
import type { ReactNode } from "react";
import type { ProviderProps } from "@fumapress/core";
import { PressSearchContext, searchOptions, type PressSearch } from "@fumapress/core/search.client";
import { RootProvider } from "fumadocs-ui/provider/astro";
import { rootProps, type ProviderData } from "./content";
import { Link } from "./link";

/** the root provider of pages, with `providerProps` of the site and the search of its search plugin */
export function Provider({
  provider,
  props,
  search,
  children,
}: {
  provider: ProviderData;
  /** without `i18n`, the server merges it into `provider` */
  props: Omit<ProviderProps, "i18n">;
  search?: PressSearch;
  children: ReactNode;
}) {
  return (
    <PressSearchContext value={search}>
      <RootProvider
        {...props}
        {...rootProps(provider, Link)}
        search={searchOptions(search, props.search)}
      >
        {children}
      </RootProvider>
    </PressSearchContext>
  );
}
