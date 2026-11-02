"use client";
import { lazy, useMemo, type ReactNode } from "react";
import { RootProvider } from "fumadocs-ui/provider/astro";
import { Provider as LayoutProvider, SearchDialog, useSearch } from "virtual:fumapress/layout";
import { rootProps, type ProviderData } from "./content";
import { Link } from "./link";

/** the root provider of layouts, with the search and `Provider` of the layout module */
export function Provider({ provider, children }: { provider: ProviderData; children: ReactNode }) {
  const { search } = provider;
  const Dialog = useMemo(
    () =>
      SearchDialog ??
      (useSearch || search
        ? lazy(async () => (await import("./search")).loadSearchDialog(search))
        : undefined),
    [search],
  );

  return (
    <RootProvider
      {...rootProps(provider, Link)}
      search={Dialog ? { SearchDialog: Dialog } : { enabled: false }}
    >
      {LayoutProvider ? <LayoutProvider>{children}</LayoutProvider> : children}
    </RootProvider>
  );
}
