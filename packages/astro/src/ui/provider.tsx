"use client";
import type { ReactNode } from "react";
import type { ProviderProps } from "@fumapress/core";
import { RootProvider } from "fumadocs-ui/provider/astro";
import { rootProps, type ProviderData } from "./content";
import { Link } from "./link";

/** the root provider of pages, with `providerProps` of the site */
export function Provider({
  provider,
  props,
  children,
}: {
  provider: ProviderData;
  /** without `i18n`, the server merges it into `provider` */
  props: Omit<ProviderProps, "i18n">;
  children: ReactNode;
}) {
  return (
    <RootProvider {...props} {...rootProps(provider, Link)}>
      {children}
    </RootProvider>
  );
}
